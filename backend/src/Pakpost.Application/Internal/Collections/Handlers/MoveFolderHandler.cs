using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class MoveFolderHandler(IWorkspaceRepository w, ICollectionRepository c, ICollectionFolderRepository folders, IUnitOfWork uow)
    : IRequestHandler<MoveFolderCommand, FolderDto>
{
    public async ValueTask<FolderDto> Handle(MoveFolderCommand q, CancellationToken ct)
    {
        await CloudFolderRules.CheckAccess(q.ActorId, q.WorkspaceId, q.CollectionId, true, w, c, ct);
        var f = await folders.FindAsync(q.FolderId, ct);
        if (f is null || f.CollectionId != q.CollectionId)
            throw AppException.NotFound("Folder not found");
        if (q.ExpectedVersion <= 0 || f.Version != q.ExpectedVersion)
            throw AppException.Conflict("Folder changed: reload first");
        var list = await folders.ListAsync(q.CollectionId, ct);
        CloudFolderRules.ValidatePlacement(list, q.CollectionId, q.TargetParentId, f.Name, f.Id);
        // Descendants may make this subtree deeper than 24 even if parent fits.
        int DescendantDepth(Guid id, HashSet<Guid> visiting)
        {
            if (!visiting.Add(id))
                throw AppException.BadRequest("Invalid cyclic folder tree");
            var depth = 0;
            foreach (var child in list.Where(x => x.ParentFolderId == id))
                depth = Math.Max(depth, 1+DescendantDepth(child.Id, visiting));
            visiting.Remove(id);
            return depth;
        }
        int parentDepth = 0;
        Guid? cursor = q.TargetParentId;
        var map = list.ToDictionary(x => x.Id);
        while (cursor is Guid id)
        {
            parentDepth++;
            cursor = map[id].ParentFolderId;
        }
        if (parentDepth+1+DescendantDepth(f.Id, new HashSet<Guid>())>24)
            throw AppException.BadRequest("Folder subtree would exceed maximum depth");
        f.Move(q.TargetParentId);
        await uow.SaveChangesAsync(ct);
        return CloudFolderRules.ToDto(f);
    }
}
