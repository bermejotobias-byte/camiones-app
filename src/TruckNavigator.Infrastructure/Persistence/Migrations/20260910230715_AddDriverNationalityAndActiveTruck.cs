using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TruckNavigator.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDriverNationalityAndActiveTruck : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ActiveTruckId",
                table: "DriverProfiles",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Nationality",
                table: "DriverProfiles",
                type: "TEXT",
                maxLength: 2,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_DriverProfiles_ActiveTruckId",
                table: "DriverProfiles",
                column: "ActiveTruckId");

            migrationBuilder.AddForeignKey(
                name: "FK_DriverProfiles_TruckProfiles_ActiveTruckId",
                table: "DriverProfiles",
                column: "ActiveTruckId",
                principalTable: "TruckProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DriverProfiles_TruckProfiles_ActiveTruckId",
                table: "DriverProfiles");

            migrationBuilder.DropIndex(
                name: "IX_DriverProfiles_ActiveTruckId",
                table: "DriverProfiles");

            migrationBuilder.DropColumn(
                name: "ActiveTruckId",
                table: "DriverProfiles");

            migrationBuilder.DropColumn(
                name: "Nationality",
                table: "DriverProfiles");
        }
    }
}
