using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TruckNavigator.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTripStops : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Stops",
                table: "Trips",
                type: "TEXT",
                nullable: false,
                defaultValue: "[]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Stops",
                table: "Trips");
        }
    }
}
