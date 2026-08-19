using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TruckNavigator.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPointsOfInterest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PointsOfInterest",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 48, nullable: false),
                    Address = table.Column<string>(type: "TEXT", maxLength: 300, nullable: true),
                    Neighbourhood = table.Column<string>(type: "TEXT", maxLength: 120, nullable: true),
                    Latitude = table.Column<double>(type: "REAL", nullable: false),
                    Longitude = table.Column<double>(type: "REAL", nullable: false),
                    Phone = table.Column<string>(type: "TEXT", maxLength: 80, nullable: true),
                    Website = table.Column<string>(type: "TEXT", maxLength: 300, nullable: true),
                    OpeningHours = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    Description = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: true),
                    Services = table.Column<string>(type: "TEXT", nullable: false),
                    SuitableForLightTruck = table.Column<bool>(type: "INTEGER", nullable: true),
                    SuitableForHeavyTruck = table.Column<bool>(type: "INTEGER", nullable: true),
                    SuitableForSemiTrailer = table.Column<bool>(type: "INTEGER", nullable: true),
                    SuitableForTrailer = table.Column<bool>(type: "INTEGER", nullable: true),
                    Source = table.Column<string>(type: "TEXT", maxLength: 600, nullable: false),
                    SourceRetrievedOn = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    VerificationLevel = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    IsSampleData = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PointsOfInterest", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PointsOfInterest_Category",
                table: "PointsOfInterest",
                column: "Category");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PointsOfInterest");
        }
    }
}
