using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TruckNavigator.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPoiSuitabilityEvidence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ManagedByDataset",
                table: "PointsOfInterest",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SuitabilityEvidence",
                table: "PointsOfInterest",
                type: "TEXT",
                maxLength: 600,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SuitabilityEvidenceKind",
                table: "PointsOfInterest",
                type: "TEXT",
                maxLength: 32,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ManagedByDataset",
                table: "PointsOfInterest");

            migrationBuilder.DropColumn(
                name: "SuitabilityEvidence",
                table: "PointsOfInterest");

            migrationBuilder.DropColumn(
                name: "SuitabilityEvidenceKind",
                table: "PointsOfInterest");
        }
    }
}
