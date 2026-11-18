using System.Text.Json;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Services;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class SaveRequestHandler(
    IWorkspaceRepository workspaces,
    ICollectionRepository collections,
    ISavedRequestRepository requests,
    ISavedRequestRevisionRepository history,
    IEnvironmentValueCipher cipher,
    IUnitOfWork uow,
    ICollectionFolderRepository? folders = null)
    : SavedRequestsAccess, IRequestHandler<SaveRequestCommand, SavedRequestDto>
{
    public async ValueTask<SavedRequestDto> Handle(SaveRequestCommand c, CancellationToken ct)
    {
        await Check(c.ActorId, c.WorkspaceId, c.CollectionId, workspaces, collections, ct, destructive:true);
        SavedHeaderPolicy.EnsureSafe(c.HeadersJson);
        if (c.FolderId is Guid folderId)
        {
            var folder = folders is null?null:await folders.FindAsync(folderId, ct);
            if (folder is null || folder.CollectionId != c.CollectionId)
                throw AppException.BadRequest("Folder not in collection");
        }
        var item = new SavedRequest(
            c.CollectionId,
            c.Name,
            c.Method,
            c.Url,
            c.HeadersJson,
            c.Body,
            c.BodyMode,
            c.ContentType,
            c.FormFieldsJson,
            c.PreRequestScript,
            c.PostResponseScript,
            c.FolderId);
        requests.Add(item);
        history.Add(SavedRequestHistoryCodec.Capture(item, c.ActorId, "created", cipher));
        await uow.SaveChangesAsync(ct);
        return ToDto(item);
    }
}
