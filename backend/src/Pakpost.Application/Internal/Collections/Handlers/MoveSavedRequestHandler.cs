using System.Text.Json;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

public sealed class MoveSavedRequestHandler(
    IWorkspaceRepository workspaces,
    ICollectionRepository collections,
    ISavedRequestRepository requests,
    ISavedRequestRevisionRepository history,
    IEnvironmentValueCipher cipher,
    IUnitOfWork uow,
    ICollectionFolderRepository? folders = null)
    : SavedRequestsAccess, IRequestHandler<MoveSavedRequestCommand, SavedRequestDto>
{
    public async ValueTask<SavedRequestDto> Handle(MoveSavedRequestCommand cmd, CancellationToken ct)
    {
        await Check(cmd.ActorId, cmd.WorkspaceId, cmd.CollectionId, workspaces, collections, ct, destructive:true);
        var destination = await collections.FindAsync(cmd.TargetCollectionId, ct);
        if (destination is null || destination.WorkspaceId != cmd.WorkspaceId)
            throw AppException.Forbidden();
        if (cmd.TargetFolderId is Guid folderId)
        {
            var folder = folders is null?null:await folders.FindAsync(folderId, ct);
            if (folder is null || folder.CollectionId != cmd.TargetCollectionId)
                throw AppException.BadRequest("Destination folder not in target collection");
        }
        var item = await requests.FindAsync(cmd.RequestId, ct);
        if (item is null || item.CollectionId != cmd.CollectionId)
            throw AppException.NotFound("Request not found");
        await SavedRequestHistoryCodec.CaptureUpdateAsync(item, history, cipher, ct);
        item.MoveTo(cmd.TargetCollectionId, cmd.TargetFolderId);
        history.Add(SavedRequestHistoryCodec.Capture(item, cmd.ActorId, "moved", cipher));
        await uow.SaveChangesAsync(ct);
        return ToDto(item);
    }
}
