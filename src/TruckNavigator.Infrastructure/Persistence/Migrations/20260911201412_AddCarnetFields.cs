using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TruckNavigator.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCarnetFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Brand",
                table: "TruckProfiles",
                type: "TEXT",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Model",
                table: "TruckProfiles",
                type: "TEXT",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Plate",
                table: "TruckProfiles",
                type: "TEXT",
                maxLength: 7,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "BirthDate",
                table: "DriverProfiles",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Brand",
                table: "TruckProfiles");

            migrationBuilder.DropColumn(
                name: "Model",
                table: "TruckProfiles");

            migrationBuilder.DropColumn(
                name: "Plate",
                table: "TruckProfiles");

            migrationBuilder.DropColumn(
                name: "BirthDate",
                table: "DriverProfiles");
        }
    }
}
