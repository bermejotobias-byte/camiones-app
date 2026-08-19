using System.Globalization;
using System.Text.Json;
using TruckNavigator.Mobile.Services;

namespace TruckNavigator.Mobile.Pages;

public partial class MapPage : ContentPage
{
    /// <summary>Cuál de los dos campos recibe lo próximo que se elija.</summary>
    private enum Field { Origin, Destination }

    /// <summary>
    /// Espera antes de consultar el geocoder. Evita disparar una consulta por
    /// cada tecla y respeta al servicio público que hay del otro lado.
    /// </summary>
    private static readonly TimeSpan SearchDebounce = TimeSpan.FromMilliseconds(350);

    private readonly TruckNavigatorApi _api;

    private Field _activeField = Field.Origin;
    private CoordinateDto? _origin;
    private CoordinateDto? _destination;

    // Texto que la app escribió en cada campo al fijar un punto. Sirve para
    // distinguir lo que escribe el usuario de lo que escribimos nosotros: no se
    // puede confiar en una bandera, porque el EditText de Android reenvía el
    // cambio de texto de forma asincrónica, cuando la bandera ya se apagó.
    private string? _originLabel;
    private string? _destinationLabel;

    private bool _mapReady;
    private bool _pickingOnMap;
    private CancellationTokenSource? _searchCts;
    private CancellationTokenSource? _locationCts;

    // Puntos de interés cargados y el camión con el que se pidieron. La aptitud la
    // resuelve el servidor, así que cambiar de camión obliga a volver a pedirlos.
    private IReadOnlyList<PoiDto> _pois = [];
    private Guid? _poisTruckId;
    private bool _poisRequested;
    private PoiDto? _selectedPoi;

    private readonly Dictionary<PoiCategory, Switch> _categorySwitches = [];

    public MapPage(TruckNavigatorApi api)
    {
        InitializeComponent();
        _api = api;
        BuildPoiFilterRows();
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();

        TruckLabel.Text = AppState.SelectedTruck is { } truck
            ? $"{truck.Name} · {truck.DimensionsSummary}"
            : "Ningún camión seleccionado";

        UpdateHint();

        // Volver de la pantalla de camiones con otro vehículo elegido cambia qué
        // puntos son aptos, así que hay que rehacer la consulta.
        if (_mapReady && _poisTruckId != AppState.SelectedTruck?.Id)
        {
            _ = LoadPoisAsync();
        }
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();
        StopListeningForLocation();
        _searchCts?.Cancel();
    }

    // ---------------------------------------------------------- puente JS

    private void OnMapMessageReceived(object? sender, HybridWebViewRawMessageReceivedEventArgs e)
    {
        if (string.IsNullOrWhiteSpace(e.Message))
        {
            return;
        }

        try
        {
            var message = JsonSerializer.Deserialize<JsonElement>(e.Message);

            var action = message.TryGetProperty("action", out var a) ? a.GetString() : null;

            switch (action)
            {
                case "ready":
                    _mapReady = true;
                    _ = StartListeningForLocationAsync();

                    // Igual que mapTapped: este evento no llega necesariamente en el
                    // hilo de UI, y cargar los puntos toca el WebView y las etiquetas.
                    MainThread.BeginInvokeOnMainThread(async () => await LoadPoisAsync());
                    break;

                case "mapTapped":
                    // Un toque simple no fija nada: sólo saca del medio lo que esté
                    // abierto. Fijar puntos con un toque hacía que se cambiara el
                    // destino sin querer al navegar el mapa.
                    MainThread.BeginInvokeOnMainThread(() =>
                    {
                        HideSuggestions();
                        HidePoiPanels();
                    });
                    break;

                case "mapLongPress":
                    var point = new CoordinateDto(
                        message.GetProperty("lat").GetDouble(),
                        message.GetProperty("lng").GetDouble());

                    MainThread.BeginInvokeOnMainThread(async () => await HandlePointPickedAsync(point));
                    break;

                case "poiTapped":
                    var id = message.GetProperty("id").GetString();

                    MainThread.BeginInvokeOnMainThread(() => ShowPoiCard(id));
                    break;
            }
        }
        catch (JsonException)
        {
            // Mensaje malformado: se ignora en vez de tumbar la pantalla.
        }
    }

    /// <summary>
    /// Fija origen o destino en el punto que se marcó manteniendo apretado el mapa.
    /// </summary>
    private async Task HandlePointPickedAsync(CoordinateDto point)
    {
        HideSuggestions();
        HidePoiPanels();

        var field = _activeField;
        await SetPointAsync(field, point, label: null);

        // Al marcar sobre el mapa no se sabe la dirección, así que se pregunta.
        var place = await _api.ReverseGeocodeAsync(point.Latitude, point.Longitude);

        SetEntryText(field, place?.Label ?? FormatCoordinates(point));

        _pickingOnMap = false;

        // Después de fijar el origen, lo natural es seguir con el destino.
        if (field == Field.Origin && _destination is null)
        {
            _activeField = Field.Destination;
        }

        UpdateHint();
    }

    /// <summary>
    /// Inyecta JavaScript en el mapa.
    /// </summary>
    /// <remarks>
    /// El WebView de Android aborta el proceso si se lo toca desde otro hilo, y
    /// <c>RawMessageReceived</c> no siempre llega en el de UI. El marshalling se hace
    /// acá adentro, una sola vez, en vez de dejarlo en manos de cada llamador: la
    /// excepción que tira MAUI en ese caso viaja por un camino interno que ni siquiera
    /// entra en el <c>catch</c> de abajo, así que llega como crash y no como error.
    /// </remarks>
    private async Task RunScriptAsync(string script)
    {
        if (!_mapReady)
        {
            return;
        }

        try
        {
            await MainThread.InvokeOnMainThreadAsync(() => MapView.EvaluateJavaScriptAsync(script));
        }
        catch (Exception)
        {
            // Un fallo al inyectar JS no debe tumbar la pantalla.
        }
    }

    // ------------------------------------------------------------ búsqueda

    private void OnOriginFocused(object? sender, FocusEventArgs e) => _activeField = Field.Origin;

    private void OnDestinationFocused(object? sender, FocusEventArgs e) => _activeField = Field.Destination;

    // Los handlers de texto NO tocan las coordenadas.
    //
    // Intentar deducir desde acá si escribió el usuario o la app resultó ser
    // una fuente de bugs: el EditText de Android emite el evento de forma
    // asincrónica y a veces en varios pasos (por ejemplo, vacía el campo antes
    // de escribir el texto nuevo), así que cualquier bandera o comparación
    // hecha en este momento se desincroniza. En su lugar, la validez del punto
    // se decide al calcular, comparando el texto del campo contra la etiqueta
    // del lugar que se eligió. Ese chequeo no depende del orden de los eventos.

    private void OnOriginTextChanged(object? sender, TextChangedEventArgs e)
    {
        _activeField = Field.Origin;
        _ = SearchAsync(e.NewTextValue);
        UpdateDebug();
    }

    private void OnDestinationTextChanged(object? sender, TextChangedEventArgs e)
    {
        _activeField = Field.Destination;
        _ = SearchAsync(e.NewTextValue);
        UpdateDebug();
    }

    /// <summary>
    /// Un punto vale sólo si tiene coordenada y el texto del campo sigue siendo
    /// el del lugar elegido. Si el usuario editó el texto a mano, la coordenada
    /// vieja ya no representa lo que dice el campo.
    /// </summary>
    private CoordinateDto? ResolvedPoint(Field field)
    {
        var (point, label, text) = field == Field.Origin
            ? (_origin, _originLabel, OriginEntry.Text)
            : (_destination, _destinationLabel, DestinationEntry.Text);

        if (point is null || label is null)
        {
            return null;
        }

        return string.Equals(text?.Trim(), label.Trim(), StringComparison.Ordinal)
            ? point
            : null;
    }

    private async Task SearchAsync(string? query)
    {
        _searchCts?.Cancel();
        _searchCts?.Dispose();
        _searchCts = null;

        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 3)
        {
            HideSuggestions();
            return;
        }

        var cts = new CancellationTokenSource();
        _searchCts = cts;

        try
        {
            await Task.Delay(SearchDebounce, cts.Token);

            var results = await _api.SearchPlacesAsync(query, cts.Token);

            if (cts.IsCancellationRequested)
            {
                return;
            }

            SuggestionsView.ItemsSource = results;
            SuggestionsPanel.IsVisible = results.Count > 0;
        }
        catch (OperationCanceledException)
        {
            // Llegó otra tecla; esta búsqueda ya no interesa.
        }
        catch (Exception)
        {
            HideSuggestions();
        }
    }

    private async void OnSuggestionSelected(object? sender, SelectionChangedEventArgs e)
    {
        if (e.CurrentSelection.FirstOrDefault() is not PlaceDto place)
        {
            return;
        }

        SuggestionsView.SelectedItem = null;
        HideSuggestions();

        var field = _activeField;
        var point = new CoordinateDto(place.Latitude, place.Longitude);

        SetEntryText(field, place.Label);
        await SetPointAsync(field, point, place.Label);

        if (field == Field.Origin && _destination is null)
        {
            _activeField = Field.Destination;
            DestinationEntry.Focus();
        }
        else
        {
            // Con ambos puntos puestos, sacamos el teclado del medio.
            OriginEntry.Unfocus();
            DestinationEntry.Unfocus();
        }

        UpdateHint();
    }

    private void OnPickOnMap(object? sender, EventArgs e)
    {
        _activeField = Field.Destination;
        _pickingOnMap = true;
        HideSuggestions();
        DestinationEntry.Unfocus();
        UpdateHint();
    }

    private void HideSuggestions()
    {
        SuggestionsPanel.IsVisible = false;
        SuggestionsView.ItemsSource = null;
    }

    // -------------------------------------------------------------- puntos

    private async Task SetPointAsync(Field field, CoordinateDto point, string? label)
    {
        if (field == Field.Origin)
        {
            _origin = point;
            await RunScriptAsync($"setOrigin({Num(point.Latitude)},{Num(point.Longitude)})");
        }
        else
        {
            _destination = point;
            await RunScriptAsync($"setDestination({Num(point.Latitude)},{Num(point.Longitude)})");
        }

        if (_origin is null || _destination is null)
        {
            await RunScriptAsync($"centerOn({Num(point.Latitude)},{Num(point.Longitude)},15)");
        }
    }

    /// <summary>
    /// Escribe el campo desde la app. La etiqueta se registra ANTES de asignar
    /// el texto, para que el TextChanged que dispara Android la reconozca y no
    /// invalide el punto recién fijado.
    /// </summary>
    private void SetEntryText(Field field, string text)
    {
        if (field == Field.Origin)
        {
            _originLabel = text;
            OriginEntry.Text = text;
        }
        else
        {
            _destinationLabel = text;
            DestinationEntry.Text = text;
        }
    }

    private void UpdateHint()
    {
        HintLabel.Text = (ResolvedPoint(Field.Origin), ResolvedPoint(Field.Destination)) switch
        {
            (null, _) when _pickingOnMap => "Mantené apretado el mapa para fijar el destino.",
            (null, _) => "Escribí una dirección o mantené apretado el mapa para fijar el origen.",
            (_, null) => "Ahora elegí el destino: escribilo o mantené apretado el mapa.",
            _ => "Origen y destino listos. Calculá la ruta."
        };

        UpdateDebug();
    }

    /// <summary>
    /// Muestra si cada punto quedó fijado de verdad. Tener texto en el campo no
    /// alcanza: hace falta la coordenada, y que el texto siga siendo el del
    /// lugar elegido.
    /// </summary>
    private void UpdateDebug() =>
        DebugLabel.Text = $"A {Describe(Field.Origin)}   B {Describe(Field.Destination)}";

    private string Describe(Field field)
    {
        if (ResolvedPoint(field) is { } point)
        {
            return string.Format(CultureInfo.InvariantCulture,
                "OK {0:0.0000},{1:0.0000}", point.Latitude, point.Longitude);
        }

        var raw = field == Field.Origin ? _origin : _destination;

        // Distingue "nunca se eligió" de "se eligió pero después se editó el
        // texto", que son dos problemas distintos.
        return raw is null ? "--" : "texto editado";
    }

    // -------------------------------------------------- puntos de interés

    /// <summary>
    /// Arma una fila por categoría a partir de <see cref="PoiPresentation.All"/>, para
    /// que sumar una categoría sea agregar un valor al enum y nada más.
    /// </summary>
    private void BuildPoiFilterRows()
    {
        foreach (var category in PoiPresentation.All)
        {
            var toggle = new Switch { VerticalOptions = LayoutOptions.Center };
            toggle.IsToggled = PoiFilterState.IsEnabled(category);
            toggle.Toggled += (_, e) => OnCategoryToggled(category, e.Value);

            var row = new Grid
            {
                ColumnDefinitions =
                [
                    new ColumnDefinition(GridLength.Auto),
                    new ColumnDefinition(GridLength.Star),
                    new ColumnDefinition(GridLength.Auto)
                ],
                ColumnSpacing = 8
            };

            row.Add(new Label
            {
                Text = PoiPresentation.Emoji(category),
                FontSize = 14,
                VerticalOptions = LayoutOptions.Center
            }, 0);

            row.Add(new Label
            {
                Text = PoiPresentation.Label(category),
                FontSize = 13,
                VerticalOptions = LayoutOptions.Center
            }, 1);

            row.Add(toggle, 2);

            _categorySwitches[category] = toggle;
            PoiFilterRows.Add(row);
        }

        SuitableOnlySwitch.IsToggled = PoiFilterState.SuitableOnly;
    }

    private async Task LoadPoisAsync()
    {
        if (!_mapReady)
        {
            return;
        }

        var truckId = AppState.SelectedTruck?.Id;

        // Evita repetir la consulta cada vez que se vuelve a la pantalla con el mismo
        // camión: la respuesta sería idéntica.
        if (_poisRequested && _poisTruckId == truckId)
        {
            return;
        }

        _poisRequested = true;
        _poisTruckId = truckId;
        _pois = await _api.GetPoisAsync(truckId);

        var payload = JsonSerializer.Serialize(_pois.Select(p => new
        {
            id = p.Id,
            name = p.Name,
            category = p.Category,
            latitude = p.Latitude,
            longitude = p.Longitude,
            suitableForSelectedTruck = p.SuitableForSelectedTruck
        }));

        await RunScriptAsync($"setPois({payload})");
        await ApplyPoiVisibilityAsync();
    }

    private async Task ApplyPoiVisibilityAsync()
    {
        var enabled = PoiFilterState.EnabledCategories();
        var suitableOnly = PoiFilterState.SuitableOnly;

        var categories = JsonSerializer.Serialize(enabled.Select(c => c.ToString()));

        await RunScriptAsync(
            $"setPoiVisibility({categories},{(suitableOnly ? "true" : "false")})");

        UpdatePoiHiddenLabel(enabled, suitableOnly);
    }

    /// <summary>
    /// Dice cuántos puntos escondió el filtro de aptitud. Sin este cartel, un mapa
    /// vacío parece un error: hoy casi ninguna fuente declara aptitud para camión, así
    /// que el filtro estricto esconde casi todo y hay que explicar por qué.
    /// </summary>
    private void UpdatePoiHiddenLabel(IReadOnlyList<PoiCategory> enabled, bool suitableOnly)
    {
        if (!suitableOnly)
        {
            PoiHiddenLabel.Text = _pois.Count == 0
                ? "Sin puntos cargados."
                : $"{_pois.Count} puntos cargados.";
            return;
        }

        var hidden = _pois.Count(p =>
            enabled.Contains(p.ParsedCategory) && p.SuitableForSelectedTruck != true);

        PoiHiddenLabel.Text = hidden == 0
            ? $"{_pois.Count} puntos cargados."
            : $"{hidden} ocultos: la fuente no confirma que sirvan para este camión.";
    }

    private void OnCategoryToggled(PoiCategory category, bool enabled)
    {
        PoiFilterState.SetEnabled(category, enabled);
        _ = ApplyPoiVisibilityAsync();
    }

    private void OnSuitableOnlyToggled(object? sender, ToggledEventArgs e)
    {
        PoiFilterState.SuitableOnly = e.Value;
        _ = ApplyPoiVisibilityAsync();
    }

    private void OnTogglePoiFilters(object? sender, EventArgs e)
    {
        HideSuggestions();
        PoiCardPanel.IsVisible = false;

        PoiFilterPanel.IsVisible = !PoiFilterPanel.IsVisible;

        if (PoiFilterPanel.IsVisible)
        {
            // Sin camión elegido no hay contra qué comparar la aptitud.
            var hasTruck = AppState.SelectedTruck is not null;

            SuitableOnlySwitch.IsEnabled = hasTruck;
            SuitableOnlyLabel.Text = hasTruck
                ? "Solo aptos para mi camión"
                : "Solo aptos para mi camión (elegí un camión)";

            UpdatePoiHiddenLabel(PoiFilterState.EnabledCategories(), PoiFilterState.SuitableOnly);
        }
    }

    private void ShowPoiCard(string? id)
    {
        if (!Guid.TryParse(id, out var poiId))
        {
            return;
        }

        if (_pois.FirstOrDefault(p => p.Id == poiId) is not { } poi)
        {
            return;
        }

        _selectedPoi = poi;

        HideSuggestions();
        PoiFilterPanel.IsVisible = false;

        PoiNameLabel.Text = poi.Name;
        PoiCategoryLabel.Text = $"{poi.Emoji} {poi.CategoryLabel}";

        SetOptionalText(PoiAddressLabel, poi.Address, "📍 ");
        SetOptionalText(PoiHoursLabel, poi.OpeningHours, "🕒 ");
        SetOptionalText(PoiPhoneLabel, poi.Phone, "📞 ");
        SetOptionalText(PoiDescriptionLabel, poi.Description);
        SetOptionalText(
            PoiServicesLabel,
            poi.Services.Count > 0 ? string.Join(" · ", poi.Services) : null);

        PoiSuitabilityLabel.Text = poi.SuitabilityText;
        PoiVerificationLabel.Text = poi.VerificationText;

        // La fuente siempre se muestra: es el mismo criterio que el panel de
        // restricciones, donde cada nota lleva de dónde salió.
        PoiSourceLabel.Text = $"Fuente: {poi.Source}";

        PoiCallButton.IsVisible = !string.IsNullOrWhiteSpace(poi.Phone);
        PoiWebButton.IsVisible = !string.IsNullOrWhiteSpace(poi.Website);

        PoiCardPanel.IsVisible = true;
    }

    private static void SetOptionalText(Label label, string? text, string prefix = "")
    {
        label.IsVisible = !string.IsNullOrWhiteSpace(text);
        label.Text = label.IsVisible ? prefix + text : string.Empty;
    }

    private void OnClosePoiCard(object? sender, TappedEventArgs e) => HidePoiPanels();

    private void HidePoiPanels()
    {
        PoiCardPanel.IsVisible = false;
        PoiFilterPanel.IsVisible = false;
    }

    /// <summary>
    /// Fija el punto como destino reusando <see cref="SetEntryText"/> y
    /// <see cref="SetPointAsync"/>.
    /// </summary>
    /// <remarks>
    /// Escribir el <c>Entry</c> por fuera de <see cref="SetEntryText"/> rompería la
    /// validación: un punto sólo vale si el texto del campo sigue siendo exactamente la
    /// etiqueta registrada al fijarlo.
    /// </remarks>
    private async void OnUsePoiAsDestination(object? sender, EventArgs e)
    {
        if (_selectedPoi is not { } poi)
        {
            return;
        }

        HidePoiPanels();

        _activeField = Field.Destination;

        SetEntryText(Field.Destination, poi.Name);
        await SetPointAsync(
            Field.Destination,
            new CoordinateDto(poi.Latitude, poi.Longitude),
            poi.Name);

        OriginEntry.Unfocus();
        DestinationEntry.Unfocus();

        UpdateHint();
    }

    private async void OnCallPoi(object? sender, EventArgs e)
    {
        if (_selectedPoi?.Phone is not { } phone)
        {
            return;
        }

        try
        {
            PhoneDialer.Default.Open(phone);
        }
        catch (Exception)
        {
            await DisplayAlertAsync("Teléfono", phone, "Cerrar");
        }
    }

    private async void OnOpenPoiWebsite(object? sender, EventArgs e)
    {
        if (_selectedPoi?.Website is not { } website)
        {
            return;
        }

        try
        {
            await Browser.Default.OpenAsync(website, BrowserLaunchMode.SystemPreferred);
        }
        catch (Exception)
        {
            await DisplayAlertAsync("Sitio web", website, "Cerrar");
        }
    }

    // ------------------------------------------------------------------ GPS

    private async void OnLocateMe(object? sender, EventArgs e)
    {
        try
        {
            var location = await GetCurrentLocationAsync();

            if (location is null)
            {
                ShowError("No se pudo obtener la posición GPS. Revisá los permisos de ubicación.");
                return;
            }

            var point = new CoordinateDto(location.Latitude, location.Longitude);

            await RunScriptAsync($"setGpsPosition({Num(point.Latitude)},{Num(point.Longitude)})");
            await SetPointAsync(Field.Origin, point, null);

            var place = await _api.ReverseGeocodeAsync(point.Latitude, point.Longitude);
            SetEntryText(Field.Origin, place?.Label ?? "Mi ubicación");

            if (_destination is null)
            {
                _activeField = Field.Destination;
            }

            UpdateHint();
        }
        catch (Exception ex)
        {
            ShowError($"Error de GPS: {ex.Message}");
        }
    }

    private async Task<Location?> GetCurrentLocationAsync()
    {
        var status = await Permissions.CheckStatusAsync<Permissions.LocationWhenInUse>();

        if (status != PermissionStatus.Granted)
        {
            status = await Permissions.RequestAsync<Permissions.LocationWhenInUse>();
        }

        if (status != PermissionStatus.Granted)
        {
            return null;
        }

        return await Geolocation.Default.GetLocationAsync(
            new GeolocationRequest(GeolocationAccuracy.Best, TimeSpan.FromSeconds(15)));
    }

    private async Task StartListeningForLocationAsync()
    {
        if (_locationCts is not null)
        {
            return;
        }

        var status = await Permissions.CheckStatusAsync<Permissions.LocationWhenInUse>();

        if (status != PermissionStatus.Granted)
        {
            status = await Permissions.RequestAsync<Permissions.LocationWhenInUse>();
        }

        if (status != PermissionStatus.Granted)
        {
            return;
        }

        _locationCts = new CancellationTokenSource();
        Geolocation.Default.LocationChanged += OnLocationChanged;

        try
        {
            await Geolocation.Default.StartListeningForegroundAsync(
                new GeolocationListeningRequest(GeolocationAccuracy.Best, TimeSpan.FromSeconds(3)));
        }
        catch (Exception)
        {
            StopListeningForLocation();
        }
    }

    private void OnLocationChanged(object? sender, GeolocationLocationChangedEventArgs e) =>
        MainThread.BeginInvokeOnMainThread(async () =>
            await RunScriptAsync(
                $"setGpsPosition({Num(e.Location.Latitude)},{Num(e.Location.Longitude)})"));

    private void StopListeningForLocation()
    {
        if (_locationCts is null)
        {
            return;
        }

        Geolocation.Default.LocationChanged -= OnLocationChanged;

        try
        {
            Geolocation.Default.StopListeningForeground();
        }
        catch (Exception)
        {
            // El listener ya podía estar detenido.
        }

        _locationCts.Cancel();
        _locationCts.Dispose();
        _locationCts = null;
    }

    // ------------------------------------------------------------------ ruta

    private async void OnCalculateRoute(object? sender, EventArgs e)
    {
        ErrorLabel.IsVisible = false;
        NotesView.IsVisible = false;
        HideSuggestions();
        HidePoiPanels();

        if (AppState.SelectedTruck is not { } truck)
        {
            ShowError("Volvé atrás y seleccioná un camión.");
            return;
        }

        var origin = ResolvedPoint(Field.Origin);
        var destination = ResolvedPoint(Field.Destination);

        if (origin is null || destination is null)
        {
            var missing = (origin, destination) switch
            {
                (null, null) => "el origen y el destino",
                (null, _) => "el origen",
                _ => "el destino"
            };

            ShowError(
                $"Falta {missing}. Elegilo de la lista de sugerencias o manteniendo " +
                "apretado el mapa.");
            UpdateDebug();
            return;
        }

        RouteButton.IsEnabled = false;
        SummaryLabel.Text = "Calculando…";

        try
        {
            var route = await _api.GetRouteAsync(new RouteRequest
            {
                TruckId = truck.Id,
                Origin = origin,
                Destination = destination
            });

            await DrawRouteAsync(route);
        }
        catch (Exception ex)
        {
            SummaryLabel.Text = "Sin ruta calculada";
            NetworkLabel.Text = string.Empty;
            ShowError(ex.Message);
        }
        finally
        {
            RouteButton.IsEnabled = true;
        }
    }

    /// <summary>
    /// Explica el código de colores del trazado y su fundamento normativo.
    /// </summary>
    private async void OnLegendInfo(object? sender, TappedEventArgs e) =>
        await DisplayAlertAsync(
            "Colores de la ruta",
            "Azul lleno: el trayecto va por la Red de Tránsito Pesado, la red de " +
            "avenidas y calles habilitada para vehículos de más de 12 toneladas.\n\n" +
            "Naranja punteado: tramos fuera de esa Red. No son un error ni una " +
            "infracción: la normativa permite salir de la Red únicamente para " +
            "llegar al destino y regresar, por el recorrido más corto. Por eso " +
            "aparecen sólo al principio y al final del viaje.\n\n" +
            "Fundamento: Ley 2148 (Código de Tránsito y Transporte de la Ciudad), " +
            "artículos 9.10.1 y 9.10.5, modificados por la Ley 6.401/2020.\n\n" +
            "Para un vehículo de 12 toneladas o menos la Red no es obligatoria, " +
            "así que la ruta va toda en azul.",
            "Entendido");

    private async Task DrawRouteAsync(RouteResponse route)
    {
        SummaryLabel.Text =
            $"{FormatDistance(route.DistanceMeters)} · {FormatDuration(route.DurationSeconds)}";

        LegendPanel.IsVisible = true;

        // El tramo naranja sólo se explica si efectivamente hay alguno: para un
        // camión liviano la ruta va entera en azul.
        AccessLegend.IsVisible = route.AccessLegs.Count > 0;

        NetworkLabel.Text = AppState.SelectedTruck?.GrossWeightKg > 12_000
            ? $"{route.HeavyNetworkSharePercent:0.#}% del trayecto sobre la Red de Tránsito Pesado"
            : "Vehículo por debajo de 12 t: la Red de Tránsito Pesado no es obligatoria";

        var notes = RestrictionNoteView.From(route);
        NotesView.ItemsSource = notes;
        NotesView.IsVisible = notes.Count > 0;

        var coordinates = JsonSerializer.Serialize(route.Geometry.Coordinates);

        var accessLegs = JsonSerializer.Serialize(route.AccessLegs
            .Select(leg => new { from = leg.FromPointIndex, to = leg.ToPointIndex })
            .ToList());

        await RunScriptAsync($"setRoute({coordinates},{accessLegs})");
    }

    // -------------------------------------------------------------- helpers

    private void ShowError(string message)
    {
        ErrorLabel.Text = message;
        ErrorLabel.IsVisible = true;
    }

    private static string FormatCoordinates(CoordinateDto point) =>
        string.Format(CultureInfo.CurrentCulture, "{0:0.0000}, {1:0.0000}",
            point.Latitude, point.Longitude);

    /// <summary>Formatea con punto decimal para inyectar en JavaScript.</summary>
    private static string Num(double value) =>
        value.ToString("0.######", CultureInfo.InvariantCulture);

    private static string FormatDistance(double meters) =>
        meters >= 1000
            ? string.Format(CultureInfo.CurrentCulture, "{0:0.0} km", meters / 1000)
            : string.Format(CultureInfo.CurrentCulture, "{0:0} m", meters);

    private static string FormatDuration(double seconds)
    {
        var span = TimeSpan.FromSeconds(seconds);

        return span.TotalHours >= 1
            ? $"{(int)span.TotalHours} h {span.Minutes} min"
            : $"{span.Minutes} min";
    }
}
