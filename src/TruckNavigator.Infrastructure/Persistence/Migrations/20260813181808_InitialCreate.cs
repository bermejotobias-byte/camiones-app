using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TruckNavigator.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TruckProfiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 120, nullable: false),
                    GrossWeightKg = table.Column<int>(type: "INTEGER", nullable: false),
                    HeightMeters = table.Column<double>(type: "REAL", nullable: false),
                    WidthMeters = table.Column<double>(type: "REAL", nullable: false),
                    LengthMeters = table.Column<double>(type: "REAL", nullable: false),
                    NumberOfAxles = table.Column<int>(type: "INTEGER", nullable: false),
                    VehicleType = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    HasTrailer = table.Column<bool>(type: "INTEGER", nullable: false),
                    TrailerLengthMeters = table.Column<double>(type: "REAL", nullable: true),
                    IsSampleData = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TruckProfiles", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TruckProfiles");
        }
    }
}
