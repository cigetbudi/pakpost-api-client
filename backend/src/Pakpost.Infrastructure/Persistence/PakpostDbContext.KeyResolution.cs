using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence;

public sealed partial class PakpostDbContext
{
    public async Task<Guid> WorkspaceForCollectionAsync(Guid collectionId, CancellationToken ct)
    {
        if (_collectionWorkspaces.TryGetValue(collectionId, out var workspaceId))
        {
            return workspaceId;
        }

        var tracked = Collections.Local.FirstOrDefault(item => item.Id == collectionId);

        workspaceId = tracked?.WorkspaceId
            ?? await Collections.AsNoTracking()
                .Where(item => item.Id == collectionId)
                .Select(item => item.WorkspaceId)
                .SingleAsync(ct);

        _collectionWorkspaces[collectionId] = workspaceId;
        return workspaceId;
    }

    private async Task<Guid> WorkspaceForEnvironmentAsync(Guid environmentId, CancellationToken ct)
    {
        if (_environmentWorkspaces.TryGetValue(environmentId, out var workspaceId))
        {
            return workspaceId;
        }

        var tracked = RequestEnvironments.Local.FirstOrDefault(item => item.Id == environmentId);

        workspaceId = tracked?.WorkspaceId
            ?? await RequestEnvironments.AsNoTracking()
                .Where(item => item.Id == environmentId)
                .Select(item => item.WorkspaceId)
                .SingleAsync(ct);

        _environmentWorkspaces[environmentId] = workspaceId;
        return workspaceId;
    }

    public async Task<Guid> CollectionForRequestAsync(Guid requestId, CancellationToken ct)
    {
        if (_requestCollections.TryGetValue(requestId, out var collectionId))
        {
            return collectionId;
        }

        var tracked = SavedRequests.Local.FirstOrDefault(item => item.Id == requestId);

        collectionId = tracked?.CollectionId
            ?? await SavedRequests.AsNoTracking()
                .Where(item => item.Id == requestId)
                .Select(item => item.CollectionId)
                .SingleAsync(ct);

        _requestCollections[requestId] = collectionId;
        return collectionId;
    }

    private async Task<byte[]> GetWorkspaceKeyAsync(Guid workspaceId, CancellationToken ct)
    {
        if (_workspaceKeys.TryGetValue(workspaceId, out var cached))
        {
            return cached;
        }

        var stored = await WorkspaceEncryptionKeys.AsNoTracking()
            .SingleOrDefaultAsync(key => key.WorkspaceId == workspaceId, ct);

        if (stored is null || stored.KeyVersion != 1 || stored.MasterKeyId != "master-v1")
        {
            throw new CryptographicException(
                "Workspace encryption key missing or incompatible; refusing plaintext fallback");
        }

        var dek = _cryptography!.Unwrap(workspaceId, stored.WrappedKey);

        if (dek.Length != 32)
        {
            CryptographicOperations.ZeroMemory(dek);
            throw new CryptographicException("Invalid workspace encryption key length");
        }

        _workspaceKeys.Add(workspaceId, dek);
        return dek;
    }

    private void ClearKeys()
    {
        foreach (var key in _workspaceKeys.Values)
        {
            CryptographicOperations.ZeroMemory(key);
        }

        _workspaceKeys.Clear();
    }

    public override void Dispose()
    {
        ClearKeys();
        base.Dispose();
    }

    public override async ValueTask DisposeAsync()
    {
        ClearKeys();
        await base.DisposeAsync();
    }

}
