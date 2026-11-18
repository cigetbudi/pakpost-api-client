using System.Text.Json;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class RestoreSavedRequestHistoryHandler(IWorkspaceRepository workspaces, ICollectionRepository collections,
    ISavedRequestRepository requests, ISavedRequestRevisionRepository history, IEnvironmentValueCipher cipher, IUnitOfWork uow)
    : IRequestHandler<RestoreSavedRequestHistoryCommand, SavedRequestDto>
{
    public async ValueTask<SavedRequestDto> Handle(RestoreSavedRequestHistoryCommand c, CancellationToken ct)
    {
        var item = await SavedRequestHistoryAccess.Check(c.ActorId, c.WorkspaceId, c.CollectionId, c.RequestId, true, workspaces, collections, requests, ct);
        if (c.ExpectedRevision <= 0)
            throw new AppException(428, "Current revision is required");
        if (item.Revision != c.ExpectedRevision)
            throw AppException.Conflict("Cloud request changed. Reload before restoring.");
        var target = await history.FindAsync(item.Id, c.Revision, ct)??throw AppException.NotFound("Revision not found");
        var old = SavedRequestHistoryCodec.Open(target, cipher);
        SavedHeaderPolicy.EnsureSafe(old.HeadersJson);
        await SavedRequestHistoryCodec.CaptureUpdateAsync(item, history, cipher, ct);
        item.Update(old.Name, old.Method, old.Url, old.HeadersJson, old.Body, old.BodyMode,
            old.ContentType, old.FormFieldsJson, old.PreRequestScript, old.PostResponseScript);
        history.Add(SavedRequestHistoryCodec.Capture(item, c.ActorId, "restored", cipher));
        await uow.SaveChangesAsync(ct); // EF revision token protects concurrent restore/PUT
        return new SavedRequestDto(item.Id, item.CollectionId, item.Name, item.Method, item.Url,
            SavedHeaderPolicy.RedactLegacyCredentials(item.HeadersJson), item.Body, item.BodyMode, item.ContentType,
            item.FormFieldsJson, item.PreRequestScript, item.PostResponseScript, item.Revision);
    }
}
