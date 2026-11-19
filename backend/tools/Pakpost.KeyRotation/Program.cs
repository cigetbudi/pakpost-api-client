using System.Data;
using System.Security.Cryptography;
using Npgsql;
using Pakpost.Infrastructure.Services;

// Maintenance-only command. Never expose it as an HTTP endpoint or run it alongside the API.
var execute = args.Contains("--execute", StringComparer.Ordinal);
var dryRun = args.Contains("--dry-run", StringComparer.Ordinal);

if (execute == dryRun || args.Length != 3 ||
    !args.Contains("--expect-database", StringComparer.Ordinal))
{
    Console.Error.WriteLine(
        "Usage: --dry-run|--execute --expect-database <database-name> " +
        "(set ConnectionStrings__Postgres, WorkspaceRotation__OldMasterKey, " +
        "WorkspaceRotation__OldMasterKeyId, WorkspaceRotation__NewMasterKey, " +
        "WorkspaceRotation__NewMasterKeyId, WorkspaceRotation__ExpectedWorkspaces)");
    return 2;
}

var expectedDatabase = args[Array.IndexOf(args, "--expect-database") + 1];

try
{
    var connectionString = Required("ConnectionStrings__Postgres");
    var oldId = Required("WorkspaceRotation__OldMasterKeyId");
    var newId = Required("WorkspaceRotation__NewMasterKeyId");
    var oldKey = Required("WorkspaceRotation__OldMasterKey");
    var newKey = Required("WorkspaceRotation__NewMasterKey");
    var expectedCount = int.Parse(Required("WorkspaceRotation__ExpectedWorkspaces"));

    if (expectedCount < 0 || oldId == newId)
        throw new InvalidOperationException("Rotation must change the key ID");

    var oldBytes = Convert.FromBase64String(oldKey);
    var newBytes = Convert.FromBase64String(newKey);
    try
    {
        if (oldBytes.Length != 32 || newBytes.Length != 32 ||
            CryptographicOperations.FixedTimeEquals(oldBytes, newBytes))
            throw new InvalidOperationException("Rotation requires two different 256-bit keys");
    }
    finally
    {
        CryptographicOperations.ZeroMemory(oldBytes);
        CryptographicOperations.ZeroMemory(newBytes);
    }

    using var oldCrypto = Crypto(oldKey, oldId);
    using var newCrypto = Crypto(newKey, newId);
    await using var connection = new NpgsqlConnection(connectionString);
    await connection.OpenAsync();
    await using var transaction = await connection.BeginTransactionAsync(IsolationLevel.Serializable);
    await using (var timeout = new NpgsqlCommand("SET LOCAL lock_timeout = '5s'", connection, transaction))
        await timeout.ExecuteNonQueryAsync();

    await using (var dbCommand = new NpgsqlCommand("SELECT current_database()", connection, transaction))
    {
        var database = (string)(await dbCommand.ExecuteScalarAsync()
            ?? throw new InvalidOperationException("Cannot determine database"));
        if (!string.Equals(database, expectedDatabase, StringComparison.Ordinal))
            throw new InvalidOperationException($"Unexpected database '{database}'");
    }

    var rows = new List<(Guid WorkspaceId, string WrappedKey)>();
    await using (var command = new NpgsqlCommand("""
        SELECT workspace_id, key_version, master_key_id, wrapped_key
        FROM organization.workspace_encryption_keys
        ORDER BY workspace_id FOR UPDATE
        """, connection, transaction))
    await using (var reader = await command.ExecuteReaderAsync())
    {
        while (await reader.ReadAsync())
        {
            var workspaceId = reader.GetGuid(0);
            if (reader.GetInt32(1) != 1 || reader.GetString(2) != oldId)
                throw new CryptographicException(
                    $"Workspace {workspaceId} has an unexpected encryption key version/ID");
            rows.Add((workspaceId, reader.GetString(3)));
        }
    }

    await using (var count = new NpgsqlCommand(
        "SELECT count(*) FROM organization.workspaces", connection, transaction))
    {
        var workspaces = (long)(await count.ExecuteScalarAsync() ?? 0L);
        if (workspaces != expectedCount || rows.Count != expectedCount)
            throw new InvalidOperationException(
                $"Workspace count mismatch: expected {expectedCount}, workspaces {workspaces}, keys {rows.Count}");
    }

    // Validate EVERY old key and prepare EVERY new wrapper before the first UPDATE.
    var updates = new List<(Guid WorkspaceId, string NewWrappedKey)>();
    foreach (var row in rows)
    {
        updates.Add((row.WorkspaceId,
            WorkspaceKeyRewrap.Rewrap(row.WorkspaceId, oldId, row.WrappedKey, oldCrypto, newCrypto)));
    }

    if (!execute)
    {
        Console.WriteLine($"DRY RUN OK: {rows.Count} Workspace DEKs verified; database '{expectedDatabase}'. No writes.");
        await transaction.RollbackAsync();
        return 0;
    }

    foreach (var update in updates)
    {
        await using var command = new NpgsqlCommand("""
            UPDATE organization.workspace_encryption_keys
            SET master_key_id = @new_id, wrapped_key = @wrapped
            WHERE workspace_id = @workspace_id AND master_key_id = @old_id AND key_version = 1
            """, connection, transaction);
        command.Parameters.AddWithValue("new_id", newId);
        command.Parameters.AddWithValue("wrapped", update.NewWrappedKey);
        command.Parameters.AddWithValue("workspace_id", update.WorkspaceId);
        command.Parameters.AddWithValue("old_id", oldId);
        if (await command.ExecuteNonQueryAsync() != 1)
            throw new InvalidOperationException("Concurrent change detected; rolling back rotation");
    }

    await transaction.CommitAsync();
    Console.WriteLine($"COMMITTED: {updates.Count} Workspace DEKs rewrapped in '{expectedDatabase}'. " +
        "Deploy the NEW master key AND its ID together before restarting the API.");
    return 0;
}
catch (Exception exception)
{
    Console.Error.WriteLine($"Rotation aborted: {exception.GetType().Name}: {exception.Message}");
    return 1;
}

static string Required(string name) =>
    Environment.GetEnvironmentVariable(name) is { Length: > 0 } value
        ? value
        : throw new InvalidOperationException($"Missing {name}");

static WorkspaceCryptography Crypto(string key, string id) => new(key, id);
