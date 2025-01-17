import { GlideClusterClient, InfBoundary } from "@valkey/valkey-glide";
import { KEYS, DEFAULT_PLAYERS } from "../constants.js";
import { cleanupCluster } from "../utils/cleanUpServer.js";

export class LeaderboardService {
  constructor() {
    this.client = null;
    this.initializing = false;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    if (this.initializing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return await this.initialize();
    }

    try {
      this.initializing = true;
      const host = process.env.VALKEY_CLUSTER_HOST || "localhost";
      const port = process.env.VALKEY_CLUSTER_PORT || 7000;

      this.client = await GlideClusterClient.createClient({
        addresses: [{ host, port: parseInt(port) }],
        clientName: "leaderboard-client",
      });

      this.initialized = true;
    } catch (error) {
      console.error("[LeaderboardService] Initialization error:", error);
      throw error;
    } finally {
      this.initializing = false;
    }
  }

  async initializeLeaderboard() {
    await this.initialize();
    const operations = [];

    await cleanupCluster();
    operations.push(
      "\x1b[1mDEL leaderboard\x1b[0m // Cleaning up previous game"
    );

    for (const player of DEFAULT_PLAYERS) {
      const playerKey = `${KEYS.PLAYER_PREFIX}${player.id}`;
      await this.client.hset(playerKey, player);
      operations.push(
        `\x1b[1mHSET ${playerKey}\x1b[0m // Adding player ${player.name}`
      );
    }

    const zaddOperations = DEFAULT_PLAYERS.map((player) => ({
      score: player.score,
      element: `${KEYS.PLAYER_PREFIX}${player.id}`,
    }));

    await this.client.zadd(KEYS.LEADERBOARD, zaddOperations);

    operations.push(
      `\x1b[1mZADD leaderboard\x1b[0m // Setting scores for ${DEFAULT_PLAYERS.length} players in batch`
    );

    console.log("Successfully initialized leaderboard in Valkey cluster");
    const currentState = await this.getLeaderboardState();
    return { operations, state: currentState };
  }

  async getLeaderboardState() {
    try {
      const sortedPlayers = await this.client.zrangeWithScores(
        KEYS.LEADERBOARD,
        {
          start: InfBoundary.PositiveInfinity,
          end: InfBoundary.NegativeInfinity,
          type: "byScore",
        },
        { reverse: true }
      );

      const players = await Promise.all(
        sortedPlayers.map(async ({ element, score }) => {
          const playerId = parseInt(element.split(":")[1]);
          const playerKey = `${KEYS.PLAYER_PREFIX}${playerId}`;
          const playerData = await this.client.hgetall(playerKey);

          if (!playerData) return null;

          return {
            id: playerId,
            name: playerData.name,
            photo: playerData.photo,
            score: parseInt(score),
          };
        })
      );

      return players.filter(Boolean);
    } catch (error) {
      console.error("Error getting leaderboard state:", error);
      return [];
    }
  }

  async updateScore(playerId, change) {
    const playerKey = `${KEYS.PLAYER_PREFIX}${playerId}`;
    const operations = [];

    try {
      const playerData = await this.client.hgetall(playerKey);
      if (!playerData) throw new Error(`Player not found: ${playerKey}`);

      if (!playerData.name) {
        playerData.name = `Player ${playerId}`;
        await this.client.hset(playerKey, { name: playerData.name });
        console.warn(
          `[LeaderboardService] Assigned default name to player: ${playerKey}`
        );
      }

      const newScore = await this.client.zincrby(
        KEYS.LEADERBOARD,
        change,
        playerKey
      );

      operations.push(
        `\x1b[1mZINCRBY\x1b[0m leaderboard ${change} for ${playerData.name}`
      );
      operations.push(
        `\x1b[1mHSET\x1b[0m ${playerKey} score ${newScore} // Updated score`
      );

      await this.client.hset(playerKey, {
        ...playerData,
        score: newScore.toString(),
      });

      const state = await this.getLeaderboardState();
      return { operations, state };
    } catch (error) {
      console.error("[LeaderboardService] Score update error:", error);
      throw error;
    }
  }

  async cleanup() {
    try {
      if (this.client) {
        await cleanupCluster();
        this.client.close();
        this.client = null;
      }
      this.initialized = false;
    } catch (error) {
      console.error("[LeaderboardService] Cleanup error:", error);
      throw error;
    }
  }
}
