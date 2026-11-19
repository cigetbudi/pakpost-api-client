using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence;

public sealed partial class PakpostDbContext
{
    private readonly Dictionary<Guid, byte[]> _workspaceKeys = [];
    private readonly Dictionary<Guid, Guid> _collectionWorkspaces = [];
    private readonly Dictionary<Guid, Guid> _environmentWorkspaces = [];
    private readonly Dictionary<Guid, Guid> _requestCollections = [];
    private readonly HashSet<object> _decryptedEntities = new(ReferenceEqualityComparer.Instance);

    private sealed record StagedField(
        PropertyEntry Property,
        string Plaintext,
        object? PreviousOriginalValue,
        bool WasModified);

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        SaveChangesAsync(true, cancellationToken);

    public override async Task<int> SaveChangesAsync(
        bool acceptAllChangesOnSuccess,
        CancellationToken cancellationToken = default)
    {
        if (_cryptography is null)
        {
            throw new InvalidOperationException(
                "Workspace encryption service is required for persistence");
        }

        if (!acceptAllChangesOnSuccess)
        {
            throw new NotSupportedException(
                "Workspace-encrypted persistence requires automatic change acceptance");
        }

        ChangeTracker.DetectChanges();

        var originallyAdded = ChangeTracker.Entries()
            .Where(entry => entry.State == EntityState.Added &&
                entry.Entity is Collection or SavedRequest or
                    RequestEnvironmentVariable or SavedRequestRevision)
            .Select(entry => entry.Entity)
            .ToArray();

        var staged = new List<StagedField>();
        var saved = false;

        try
        {
            foreach (var workspace in ChangeTracker.Entries<Workspace>()
                .Where(entry => entry.State == EntityState.Added)
                .Select(entry => entry.Entity)
                .ToArray())
            {
                var key = RandomNumberGenerator.GetBytes(32);
                _workspaceKeys.Add(workspace.Id, key);
                WorkspaceEncryptionKeys.Add(new WorkspaceEncryptionKey(
                    workspace.Id,
                    _cryptography.Wrap(workspace.Id, key),
                    _cryptography.MasterKeyId));
            }

            await StageSensitiveFieldsAsync(staged, cancellationToken);
            var result = await base.SaveChangesAsync(true, cancellationToken);
            saved = true;

            foreach (var entity in originallyAdded)
            {
                _decryptedEntities.Add(entity);
            }

            return result;
        }
        finally
        {
            for (var i = staged.Count - 1; i >= 0; i--)
            {
                var field = staged[i];
                field.Property.CurrentValue = field.Plaintext;

                if (saved)
                {
                    field.Property.OriginalValue = field.Plaintext;
                    field.Property.IsModified = false;
                }
                else
                {
                    field.Property.OriginalValue = field.PreviousOriginalValue;
                    if (field.Property.EntityEntry.State == EntityState.Modified)
                    {
                        field.Property.IsModified = field.WasModified;
                    }
                }
            }
        }
    }

    public override int SaveChanges() =>
        throw new NotSupportedException("Use SaveChangesAsync for encrypted persistence");

    public override int SaveChanges(bool acceptAllChangesOnSuccess) =>
        throw new NotSupportedException("Use SaveChangesAsync for encrypted persistence");

    private async Task StageSensitiveFieldsAsync(
        List<StagedField> staged,
        CancellationToken ct)
    {
        foreach (var entry in ChangeTracker.Entries<Collection>()
            .Where(IsWriting)
            .ToArray())
        {
            await StageAsync(entry, entry.Entity.WorkspaceId, "collection",
                entry.Entity.Id, nameof(Collection.VariablesJson), false, staged, ct);
        }

        foreach (var entry in ChangeTracker.Entries<SavedRequest>()
            .Where(IsWriting)
            .ToArray())
        {
            var request = entry.Entity;
            var workspaceId = await WorkspaceForCollectionAsync(request.CollectionId, ct);

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
                var jsonb = field is nameof(SavedRequest.HeadersJson) or nameof(SavedRequest.FormFieldsJson);

                await StageAsync(entry, workspaceId, "request", request.Id,
                    field, jsonb, staged, ct);
            }
        }

        foreach (var entry in ChangeTracker.Entries<RequestEnvironmentVariable>()
            .Where(IsWriting)
            .ToArray())
        {
            var workspaceId = await WorkspaceForEnvironmentAsync(entry.Entity.EnvironmentId, ct);

            await StageAsync(entry, workspaceId, "environment-variable", entry.Entity.Id,
                nameof(RequestEnvironmentVariable.StoredValue), false, staged, ct);
        }

        foreach (var entry in ChangeTracker.Entries<SavedRequestRevision>()
            .Where(IsWriting)
            .ToArray())
        {
            var request = entry.Entity;
            var collectionId = await CollectionForRequestAsync(request.RequestId, ct);
            var workspaceId = await WorkspaceForCollectionAsync(collectionId, ct);

            await StageAsync(entry, workspaceId, "request-revision", request.Id,
                nameof(SavedRequestRevision.EncryptedSnapshot), false, staged, ct);
        }
    }

    private static bool IsWriting<TEntity>(EntityEntry<TEntity> entry)
        where TEntity : class =>
        entry.State is EntityState.Added or EntityState.Modified;

    private async Task StageAsync<TEntity>(
        EntityEntry<TEntity> entry,
        Guid workspaceId,
        string kind,
        Guid recordId,
        string propertyName,
        bool jsonb,
        List<StagedField> staged,
        CancellationToken ct)
        where TEntity : class
    {
        var property = entry.Property(propertyName);

        if (entry.State != EntityState.Added && !property.IsModified)
        {
            return;
        }

        var plaintext = (string?)property.CurrentValue
            ?? throw new InvalidOperationException("Encrypted field cannot be null");

        var key = await GetWorkspaceKeyAsync(workspaceId, ct);
        var encrypted = _cryptography!.Protect(
            key, workspaceId, kind, recordId, propertyName, plaintext);

        staged.Add(new StagedField(property, plaintext, property.OriginalValue, property.IsModified));
        property.CurrentValue = jsonb ? JsonSerializer.Serialize(encrypted) : encrypted;
    }

}
