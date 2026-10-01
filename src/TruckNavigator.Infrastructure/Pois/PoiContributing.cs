using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Pois;
using TruckNavigator.Domain.Progression;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Infrastructure.Persistence;
using TruckNavigator.Infrastructure.Progression;

namespace TruckNavigator.Infrastructure.Pois;

/// <summary>Lo que un camionero carga al agregar un lugar.</summary>
public sealed record NewPlace(
    string Name,
    PoiCategory Category,
    double Latitude,
    double Longitude,
    string? Address,
    string? Description);

/// <summary>
/// Lo que vuelve despues de agregar: el lugar creado con su ficha y lo que pago, o
/// —si ya habia uno igual a menos de 25 m— cual es, para ofrecer votarlo.
/// </summary>
public sealed record AddPlaceResult(
    PointOfInterest? Place,
    CommunityView? Community,
    ContributionEarnings? Earned,
    Guid? DuplicateOf);

/// <summary>
/// Agregar un lugar: nace de la comunidad, con su primer voto, y paga como un
/// viaje corto.
/// </summary>
/// <remarks>
/// <para>
/// <b>El aporte trae su primer voto</b>: quien carga un lugar vota "apto" con su
/// camion en la misma operacion —no lo cargaria si no lo fuera—. Ese voto no paga
/// aparte: lo que paga es el aporte, una vez por lugar creado.
/// </para>
/// <para>
/// El duplicado se mide con el mismo umbral que el candado del dataset: misma
/// categoria a menos de 25 m es el mismo lugar. Se devuelve el existente en vez
/// de un error a secas, para que la interfaz ofrezca votarlo.
/// </para>
/// </remarks>
public sealed class PoiContributing(AppDbContext db, ProgressionRecorder progression, CommunityReader community)
{
    public async Task<AddPlaceResult> AddAsync(
        Guid driverId,
        NewPlace place,
        TruckProfile truck,
        DateTimeOffset when,
        CancellationToken ct = default)
    {
        // El dominio valida antes de tocar la base: nombre y area. Tira con motivo.
        var poi = PoiContribution.Create(
            driverId,
            place.Name,
            place.Category,
            place.Latitude,
            place.Longitude,
            place.Address,
            place.Description,
            when);

        // Las consultas de la app siempre llegan por categoria (hay indice); la
        // distancia se mide en memoria sobre esa lista, que es corta.
        var sameCategory = await db.PointsOfInterest
            .AsNoTracking()
            .Where(p => p.Category == place.Category)
            .Select(p => new { p.Id, p.Latitude, p.Longitude })
            .ToListAsync(ct);

        var duplicate = sameCategory.FirstOrDefault(p =>
            GeoDistance.Meters(p.Latitude, p.Longitude, place.Latitude, place.Longitude) < GeoDistance.SamePlaceMeters);

        if (duplicate is not null)
        {
            return new AddPlaceResult(null, null, null, duplicate.Id);
        }

        var truckClass = PoiSuitability.FieldFor(truck);

        db.PointsOfInterest.Add(poi);
        db.PoiVotes.Add(new PoiVote
        {
            PoiId = poi.Id,
            DriverId = driverId,
            TruckClass = truckClass,
            Verdict = PoiVerdict.Suitable,
            CastAt = when,
            UpdatedAt = when
        });

        await db.SaveChangesAsync(ct);

        var earned = await progression.RecordContributionAsync(
            driverId,
            LedgerReason.PlaceAdded,
            $"poi-added:{poi.Id}",
            when,
            ct);

        var view = (await community.ForPlacesAsync([poi.Id], truckClass, driverId, ct))[poi.Id];

        return new AddPlaceResult(poi, view, earned, null);
    }
}
