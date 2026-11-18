using System.Text.Json;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections.Services;

internal static class SavedRequestHistoryCodec
{
    public static SavedRequestRevision Capture(
        SavedRequest request,
        Guid actorId,
        string action,
        IEnvironmentValueCipher cipher)
    {
        var snapshot = new HistorySnapshot(
            request.Name,
            request.Method,
            request.Url,
            request.HeadersJson,
            request.Body,
            request.BodyMode,
            request.ContentType,
            request.FormFieldsJson,
            request.PreRequestScript,
            request.PostResponseScript);

        return new SavedRequestRevision(
            request.Id,
            request.Revision,
            actorId,
            action,
            cipher.Protect(JsonSerializer.Serialize(snapshot)));
    }

    public static HistorySnapshot Open(
        SavedRequestRevision revision,
        IEnvironmentValueCipher cipher)
    {
        return JsonSerializer.Deserialize<HistorySnapshot>(
            cipher.Unprotect(revision.EncryptedSnapshot))
            ?? throw new InvalidOperationException("Saved request revision snapshot is invalid");
    }

    public static SavedRequestDto ToDto(
        SavedRequest request,
        SavedRequestRevision revision,
        IEnvironmentValueCipher cipher)
    {
        var snapshot = Open(revision, cipher);

        return new SavedRequestDto(
            request.Id,
            request.CollectionId,
            snapshot.Name,
            snapshot.Method,
            snapshot.Url,
            SavedHeaderPolicy.RedactLegacyCredentials(snapshot.HeadersJson),
            snapshot.Body,
            snapshot.BodyMode,
            snapshot.ContentType,
            snapshot.FormFieldsJson,
            snapshot.PreRequestScript,
            snapshot.PostResponseScript,
            revision.Revision);
    }

    public static async Task CaptureUpdateAsync(
        SavedRequest request,
        ISavedRequestRevisionRepository revisions,
        IEnvironmentValueCipher cipher,
        CancellationToken cancellationToken)
    {
        if (!await revisions.AnyAsync(request.Id, cancellationToken))
        {
            revisions.Add(Capture(request, Guid.Empty, "baseline", cipher));
        }
        else
        {
            await revisions.TrimAsync(request.Id, 49, cancellationToken);
        }
    }
}
