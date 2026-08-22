using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TruckNavigator.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTruckOwner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "OwnerId",
                table: "TruckProfiles",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TruckProfiles_OwnerId",
                table: "TruckProfiles",
                column: "OwnerId");

            migrationBuilder.AddForeignKey(
                name: "FK_TruckProfiles_AspNetUsers_OwnerId",
                table: "TruckProfiles",
                column: "OwnerId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TruckProfiles_AspNetUsers_OwnerId",
                table: "TruckProfiles");

            migrationBuilder.DropIndex(
                name: "IX_TruckProfiles_OwnerId",
                table: "TruckProfiles");

            migrationBuilder.DropColumn(
                name: "OwnerId",
                table: "TruckProfiles");
        }
    }
}
