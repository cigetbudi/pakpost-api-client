using System.Text.Json;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

public sealed class UpdateSavedRequestHandler(
    IWorkspaceRepository workspaces,
    ICollectionRepository collections,
    ISavedRequestRepository requests,
    ISavedRequestRevisionRepository history,
    IEnvironmentValueCipher cipher,
    IUnitOfWork uow)
    : SavedRequestsAccess, IRequestHandler<UpdateSavedRequestCommand, SavedRequestDto>
{
    public async ValueTask<SavedRequestDto> Handle(UpdateSavedRequestCommand cmd, CancellationToken ct)
    {
        await Check(cmd.ActorId, cmd.WorkspaceId, cmd.CollectionId, workspaces, collections, ct, destructive:true);
        var item = await requests.FindAsync(cmd.RequestId, ct);
        if (item is null || item.CollectionId != cmd.CollectionId)
            throw AppException.NotFound("Request not found");
        if (cmd.ExpectedRevision is null || cmd.ExpectedRevision <= 0)
            throw new AppException(428, "Request revision required. Reload the Cloud request before saving.");
        if (item.Revision != cmd.ExpectedRevision.Value)
            throw AppException.Conflict("This request changed in another session. Review the latest version before saving.");
        SavedHeaderPolicy.EnsureSafe(cmd.HeadersJson);
        await SavedRequestHistoryCodec.CaptureUpdateAsync(item, history, cipher, ct);
        item.Update(
            cmd.Name,
            cmd.Method,
            cmd.Url,
            cmd.HeadersJson,
            cmd.Body,
            cmd.BodyMode,
            cmd.ContentType,
            cmd.FormFieldsJson,
            cmd.PreRequestScript,
            cmd.PostResponseScript);
        history.Add(SavedRequestHistoryCodec.Capture(item, cmd.ActorId, "updated", cipher));
        await uow.SaveChangesAsync(ct);
        return ToDto(item);
    }
}
