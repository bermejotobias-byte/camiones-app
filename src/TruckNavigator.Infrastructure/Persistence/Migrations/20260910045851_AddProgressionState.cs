using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TruckNavigator.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProgressionState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Loadout",
                columns: table => new
                {
                    DriverId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Slot = table.Column<string>(type: "TEXT", maxLength: 24, nullable: false),
                    RewardCode = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Loadout", x => new { x.DriverId, x.Slot });
                    table.ForeignKey(
                        name: "FK_Loadout_AspNetUsers_DriverId",
                        column: x => x.DriverId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProgressMarks",
                columns: table => new
                {
                    DriverId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CelebratedUpTo = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgressMarks", x => x.DriverId);
                    table.ForeignKey(
                        name: "FK_ProgressMarks_AspNetUsers_DriverId",
                        column: x => x.DriverId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Records",
                columns: table => new
                {
                    DriverId = table.Column<Guid>(type: "TEXT", nullable: false),
                    RecordCode = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Value = table.Column<long>(type: "INTEGER", nullable: false),
                    AchievedAt = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Records", x => new { x.DriverId, x.RecordCode });
                    table.ForeignKey(
                        name: "FK_Records_AspNetUsers_DriverId",
                        column: x => x.DriverId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Rewards",
                columns: table => new
                {
                    DriverId = table.Column<Guid>(type: "TEXT", nullable: false),
                    RewardCode = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    UnlockedAt = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rewards", x => new { x.DriverId, x.RewardCode });
                    table.ForeignKey(
                        name: "FK_Rewards_AspNetUsers_DriverId",
                        column: x => x.DriverId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TrackProgress",
                columns: table => new
                {
                    DriverId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TrackCode = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Count = table.Column<long>(type: "INTEGER", nullable: false),
                    TierReached = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrackProgress", x => new { x.DriverId, x.TrackCode });
                    table.ForeignKey(
                        name: "FK_TrackProgress_AspNetUsers_DriverId",
                        column: x => x.DriverId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Loadout");

            migrationBuilder.DropTable(
                name: "ProgressMarks");

            migrationBuilder.DropTable(
                name: "Records");

            migrationBuilder.DropTable(
                name: "Rewards");

            migrationBuilder.DropTable(
                name: "TrackProgress");
        }
    }
}
