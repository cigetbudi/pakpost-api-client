using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence;

public sealed partial class PakpostDbContext
{
    public async Task DecryptCollectionAsync(Collection collection, CancellationToken ct)
    {
        if (Entry(collection).State == EntityState.Added)
        {
            return;
        }

        if (!_decryptedEntities.Add(collection))
        {
            return;
        }

        try
        {
            await UnprotectAsync(collection, collection.WorkspaceId, "collection", collection.Id,
                nameof(Collection.VariablesJson), false, ct);
        }
        catch
        {
            _decryptedEntities.Remove(collection);
            throw;
        }
    }

    public async Task DecryptRequestAsync(SavedRequest request, Guid workspaceId, CancellationToken ct)
    {
        if (Entry(request).State == EntityState.Added)
        {
            return;
        }

        if (!_decryptedEntities.Add(request))
        {
            return;
        }

        try
        {
            foreach (var field in new[]
            {
                nameof(SavedRequest.Url),
                nameof(SavedRequest.HeadersJson),
                nameof(SavedRequest.Body),
                nameof(SavedRequest.FormFieldsJson),
                nameof(SavedRequest.PreRequestScript),
                nameof(SavedRequest.PostResponseScript)
            })
            {
                var jsonb = field is nameof(SavedRequest.HeadersJson)
                    or nameof(SavedRequest.FormFieldsJson);

                await UnprotectAsync(request, workspaceId, "request", request.Id,
                    field, jsonb, ct);
            }
        }
        catch
        {
            _decryptedEntities.Remove(request);
            throw;
        }
    }

    public async Task DecryptEnvironmentVariableAsync(
        RequestEnvironmentVariable variable,
        Guid workspaceId,
        CancellationToken ct)
    {
        if (Entry(variable).State == EntityState.Added)
        {
            return;
        }

        if (!_decryptedEntities.Add(variable))
        {
            return;
        }

        try
        {
            await UnprotectAsync(variable, workspaceId, "environment-variable", variable.Id,
                nameof(RequestEnvironmentVariable.StoredValue), false, ct);
        }
        catch
        {
            _decryptedEntities.Remove(variable);
            throw;
        }
    }

    public async Task DecryptRevisionAsync(
        SavedRequestRevision revision,
        Guid workspaceId,
        CancellationToken ct)
    {
        if (Entry(revision).State == EntityState.Added)
        {
            return;
        }

        if (!_decryptedEntities.Add(revision))
        {
            return;
        }

        try
        {
            await UnprotectAsync(revision, workspaceId, "request-revision", revision.Id,
                nameof(SavedRequestRevision.EncryptedSnapshot), false, ct);
        }
        catch
        {
            _decryptedEntities.Remove(revision);
            throw;
        }
    }

    private async Task UnprotectAsync<TEntity>(
        TEntity entity,
        Guid workspaceId,
        string kind,
        Guid recordId,
        string propertyName,
        bool jsonb,
        CancellationToken ct)
        where TEntity : class
    {
        if (_cryptography is null)
        {
            throw new InvalidOperationException("Workspace encryption service is required for reads");
        }

        var entry = Entry(entity);
        var property = entry.Property(propertyName);
        var value = (string?)property.CurrentValue
            ?? throw new CryptographicException("Missing encrypted workspace field");

        var ciphertext = jsonb
            ? JsonSerializer.Deserialize<string>(value)
            : value;

        if (ciphertext is null)
        {
            throw new CryptographicException("Invalid encrypted workspace JSON field");
        }

        var key = await GetWorkspaceKeyAsync(workspaceId, ct);
        var plaintext = _cryptography.Unprotect(
            key, workspaceId, kind, recordId, propertyName, ciphertext);

        property.CurrentValue = plaintext;

        if (entry.State != EntityState.Detached)
        {
            property.OriginalValue = plaintext;
            property.IsModified = false;
        }
    }
}
