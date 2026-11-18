using System.Text.Json;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

internal static class SavedRequestHistoryCodec
{
    public static SavedRequestRevision Capture(SavedRequest value, Guid actor, string action, IEnvironmentValueCipher cipher)
    {
        var snapshot = new HistorySnapshot(value.Name, value.Method, value.Url, value.HeadersJson, value.Body,
            value.BodyMode, value.ContentType, value.FormFieldsJson, value.PreRequestScript, value.PostResponseScript);
        return new SavedRequestRevision(value.Id, value.Revision, actor, action, cipher.Protect(JsonSerializer.Serialize(snapshot)));
    }
    public static HistorySnapshot Open(SavedRequestRevision entry, IEnvironmentValueCipher cipher)
    => JsonSerializer.Deserialize<HistorySnapshot>(cipher.Unprotect(entry.EncryptedSnapshot))
    ??throw new InvalidOperationException("Saved request revision snapshot is invalid");
    public static SavedRequestDto ToDto(SavedRequest request, SavedRequestRevision entry, IEnvironmentValueCipher cipher)
    {
        var data = Open(entry, cipher);
        return new SavedRequestDto(request.Id, request.CollectionId, data.Name, data.Method, data.Url,
            SavedHeaderPolicy.RedactLegacyCredentials(data.HeadersJson), data.Body, data.BodyMode, data.ContentType,
            data.FormFieldsJson, data.PreRequestScript, data.PostResponseScript, entry.Revision);
    }
    public static async Task CaptureUpdateAsync(SavedRequest item,
        ISavedRequestRevisionRepository history, IEnvironmentValueCipher cipher, CancellationToken ct)
    {
        // V8.4 rows predate history; preserve their existing version on the first edit.
        if (!await history.AnyAsync(item.Id, ct))history.Add(Capture(item, Guid.Empty, "baseline", cipher));
        else await history.TrimAsync(item.Id, 49, ct);
    }
}
