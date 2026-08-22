using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TruckNavigator.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTrips : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<long>(
                name: "CreatedAt",
                table: "DriverProfiles",
                type: "INTEGER",
                nullable: false,
                oldClrType: typeof(DateTimeOffset),
                oldType: "TEXT");

            migrationBuilder.CreateTable(
                name: "Trips",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    DriverId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TruckId = table.Column<Guid>(type: "TEXT", nullable: true),
                    TruckName = table.Column<string>(type: "TEXT", maxLength: 120, nullable: false),
                    OriginLatitude = table.Column<double>(type: "REAL", nullable: false),
                    OriginLongitude = table.Column<double>(type: "REAL", nullable: false),
                    OriginLabel = table.Column<string>(type: "TEXT", maxLength: 300, nullable: true),
                    DestinationLatitude = table.Column<double>(type: "REAL", nullable: false),
                    DestinationLongitude = table.Column<double>(type: "REAL", nullable: false),
                    DestinationLabel = table.Column<string>(type: "TEXT", maxLength: 300, nullable: true),
                    PlannedDistanceMeters = table.Column<double>(type: "REAL", nullable: false),
                    PlannedDurationSeconds = table.Column<double>(type: "REAL", nullable: false),
                    HeavyNetworkSharePercent = table.Column<double>(type: "REAL", nullable: false),
                    StartedAt = table.Column<long>(type: "INTEGER", nullable: false),
                    FinishedAt = table.Column<long>(type: "INTEGER", nullable: true),
                    Status = table.Column<string>(type: "TEXT", maxLength: 24, nullable: false),
                    CreditedDistanceMeters = table.Column<double>(type: "REAL", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Trips", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Trips_AspNetUsers_DriverId",
                        column: x => x.DriverId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Trips_TruckProfiles_TruckId",
                        column: x => x.TruckId,
                        principalTable: "TruckProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Trips_DriverId_StartedAt",
                table: "Trips",
                columns: new[] { "DriverId", "StartedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Trips_TruckId",
                table: "Trips",
                column: "TruckId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Trips");

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "DriverProfiles",
                type: "TEXT",
                nullable: false,
                oldClrType: typeof(long),
                oldType: "INTEGER");
        }
    }
}
