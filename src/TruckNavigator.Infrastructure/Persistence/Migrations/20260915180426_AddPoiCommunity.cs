using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TruckNavigator.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPoiCommunity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "ContributedAt",
                table: "PointsOfInterest",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ContributedBy",
                table: "PointsOfInterest",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PoiVotes",
                columns: table => new
                {
                    PoiId = table.Column<Guid>(type: "TEXT", nullable: false),
                    DriverId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TruckClass = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    Verdict = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    CastAt = table.Column<long>(type: "INTEGER", nullable: false),
                    UpdatedAt = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PoiVotes", x => new { x.PoiId, x.DriverId });
                    table.ForeignKey(
                        name: "FK_PoiVotes_AspNetUsers_DriverId",
                        column: x => x.DriverId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PoiVotes_PointsOfInterest_PoiId",
                        column: x => x.PoiId,
                        principalTable: "PointsOfInterest",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PointsOfInterest_ContributedBy",
                table: "PointsOfInterest",
                column: "ContributedBy");

            migrationBuilder.CreateIndex(
                name: "IX_PoiVotes_DriverId",
                table: "PoiVotes",
                column: "DriverId");

            migrationBuilder.CreateIndex(
                name: "IX_PoiVotes_PoiId",
                table: "PoiVotes",
                column: "PoiId");

            migrationBuilder.AddForeignKey(
                name: "FK_PointsOfInterest_AspNetUsers_ContributedBy",
                table: "PointsOfInterest",
                column: "ContributedBy",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PointsOfInterest_AspNetUsers_ContributedBy",
                table: "PointsOfInterest");

            migrationBuilder.DropTable(
                name: "PoiVotes");

            migrationBuilder.DropIndex(
                name: "IX_PointsOfInterest_ContributedBy",
                table: "PointsOfInterest");

            migrationBuilder.DropColumn(
                name: "ContributedAt",
                table: "PointsOfInterest");

            migrationBuilder.DropColumn(
                name: "ContributedBy",
                table: "PointsOfInterest");
        }
    }
}
