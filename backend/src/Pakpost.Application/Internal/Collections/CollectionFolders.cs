using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

public sealed record FolderDto(Guid Id,Guid CollectionId,Guid? ParentFolderId,string Name,int Version);
public sealed record ListFoldersQuery(Guid ActorId,Guid WorkspaceId,Guid CollectionId):IRequest<IReadOnlyList<FolderDto>>;
public sealed record CreateFolderCommand(Guid ActorId,Guid WorkspaceId,Guid CollectionId,Guid? ParentFolderId,string Name):IRequest<FolderDto>;
public sealed record RenameFolderCommand(Guid ActorId,Guid WorkspaceId,Guid CollectionId,Guid FolderId,string Name,int ExpectedVersion):IRequest<FolderDto>;
public sealed record MoveFolderCommand(Guid ActorId,Guid WorkspaceId,Guid CollectionId,Guid FolderId,Guid? TargetParentId,int ExpectedVersion):IRequest<FolderDto>;
public sealed record DeleteFolderCommand(Guid ActorId,Guid WorkspaceId,Guid CollectionId,Guid FolderId,int ExpectedVersion):IRequest;

public static class CloudFolderRules
{
    public static FolderDto ToDto(CollectionFolder f)=>new(f.Id,f.CollectionId,f.ParentFolderId,f.Name,f.Version);
    public static async Task CheckAccess(Guid actor,Guid workspace,Guid collection,bool write,
        IWorkspaceRepository workspaces,ICollectionRepository collections,CancellationToken ct)
    {
        await WorkspacePermissions.RequireAsync(workspaces,workspace,actor,
            write?WorkspacePermissions.CollectionWrite:WorkspacePermissions.CollectionRead,ct);
        var col=await collections.FindAsync(collection,ct);
        if(col is null||col.WorkspaceId!=workspace)throw AppException.NotFound("Collection not found");
    }
    public static void ValidatePlacement(IReadOnlyList<CollectionFolder> list, Guid collection, Guid? parent, string name,
        Guid? self=null)
    {
        if(string.IsNullOrWhiteSpace(name)||name.Trim().Length>120)throw AppException.BadRequest("Folder name must be 1-120 characters");
        if (list.Count >= 500 && self is null)throw AppException.BadRequest("Folder limit: 500 per collection");
        var map=list.ToDictionary(f=>f.Id);
        var level=0;
        var current=parent;
        while(current is Guid id)
        {
            if(++level>24||id==self)throw AppException.BadRequest("Folder depth or cycle not allowed");
            if(!map.TryGetValue(id,out var f)||f.CollectionId!=collection)
                throw AppException.BadRequest("Parent folder must belong to this collection");
            current=f.ParentFolderId;
        }
        if(list.Any(f=>f.Id!=self&&f.ParentFolderId==parent&&
            string.Equals(f.Name,name.Trim(),StringComparison.OrdinalIgnoreCase)))
            throw AppException.Conflict("A folder with this name already exists under the same parent");
    }
}

public sealed class ListFoldersHandler(IWorkspaceRepository w,ICollectionRepository c,ICollectionFolderRepository folders)
    :IRequestHandler<ListFoldersQuery,IReadOnlyList<FolderDto>>
{
    public async ValueTask<IReadOnlyList<FolderDto>> Handle(ListFoldersQuery q,CancellationToken ct)
    {
        await CloudFolderRules.CheckAccess(q.ActorId,q.WorkspaceId,q.CollectionId,false,w,c,ct);
        return (await folders.ListAsync(q.CollectionId,ct)).Select(CloudFolderRules.ToDto).ToArray();
    }
}
public sealed class CreateFolderHandler(IWorkspaceRepository w,ICollectionRepository c,ICollectionFolderRepository folders,IUnitOfWork uow)
    :IRequestHandler<CreateFolderCommand,FolderDto>
{
    public async ValueTask<FolderDto> Handle(CreateFolderCommand q,CancellationToken ct)
    {
        await CloudFolderRules.CheckAccess(q.ActorId,q.WorkspaceId,q.CollectionId,true,w,c,ct);
        CloudFolderRules.ValidatePlacement(await folders.ListAsync(q.CollectionId,ct),q.CollectionId,q.ParentFolderId,q.Name);
        var f=new CollectionFolder(q.CollectionId,q.ParentFolderId,q.Name);folders.Add(f);
        await uow.SaveChangesAsync(ct);return CloudFolderRules.ToDto(f);
    }
}
public sealed class RenameFolderHandler(IWorkspaceRepository w,ICollectionRepository c,ICollectionFolderRepository folders,IUnitOfWork uow)
    :IRequestHandler<RenameFolderCommand,FolderDto>
{
    public async ValueTask<FolderDto> Handle(RenameFolderCommand q,CancellationToken ct)
    {
        await CloudFolderRules.CheckAccess(q.ActorId,q.WorkspaceId,q.CollectionId,true,w,c,ct);
        var f=await folders.FindAsync(q.FolderId,ct);
        if(f is null||f.CollectionId!=q.CollectionId)throw AppException.NotFound("Folder not found");
        if(q.ExpectedVersion<=0||f.Version!=q.ExpectedVersion)throw AppException.Conflict("Folder changed: reload first");
        CloudFolderRules.ValidatePlacement(await folders.ListAsync(q.CollectionId,ct),q.CollectionId,f.ParentFolderId,q.Name,f.Id);
        f.Rename(q.Name);await uow.SaveChangesAsync(ct);return CloudFolderRules.ToDto(f);
    }
}
public sealed class MoveFolderHandler(IWorkspaceRepository w,ICollectionRepository c,ICollectionFolderRepository folders,IUnitOfWork uow)
    :IRequestHandler<MoveFolderCommand,FolderDto>
{
    public async ValueTask<FolderDto> Handle(MoveFolderCommand q,CancellationToken ct)
    {
        await CloudFolderRules.CheckAccess(q.ActorId,q.WorkspaceId,q.CollectionId,true,w,c,ct);
        var f=await folders.FindAsync(q.FolderId,ct);
        if(f is null||f.CollectionId!=q.CollectionId)throw AppException.NotFound("Folder not found");
        if(q.ExpectedVersion<=0||f.Version!=q.ExpectedVersion)throw AppException.Conflict("Folder changed: reload first");
        var list=await folders.ListAsync(q.CollectionId,ct);
        CloudFolderRules.ValidatePlacement(list,q.CollectionId,q.TargetParentId,f.Name,f.Id);
        // Descendants may make this subtree deeper than 24 even if parent fits.
        int DescendantDepth(Guid id,HashSet<Guid> visiting)
        {
            if(!visiting.Add(id))throw AppException.BadRequest("Invalid cyclic folder tree");
            var depth=0;
            foreach(var child in list.Where(x=>x.ParentFolderId==id))
                depth=Math.Max(depth,1+DescendantDepth(child.Id,visiting));
            visiting.Remove(id);return depth;
        }
        int parentDepth=0;Guid? cursor=q.TargetParentId;
        var map=list.ToDictionary(x=>x.Id);
        while(cursor is Guid id){parentDepth++;cursor=map[id].ParentFolderId;}
        if(parentDepth+1+DescendantDepth(f.Id,new HashSet<Guid>())>24)
            throw AppException.BadRequest("Folder subtree would exceed maximum depth");
        f.Move(q.TargetParentId);await uow.SaveChangesAsync(ct);return CloudFolderRules.ToDto(f);
    }
}
public sealed class DeleteFolderHandler(IWorkspaceRepository w,ICollectionRepository c,ICollectionFolderRepository f,ISavedRequestRepository r,IUnitOfWork uow)
    :IRequestHandler<DeleteFolderCommand>
{
    public async ValueTask<Unit> Handle(DeleteFolderCommand q,CancellationToken ct)
        =>await new DeleteFolderItemsHandler(w,c,f,r,uow).Handle(new DeleteFolderItemsCommand(q.ActorId,q.WorkspaceId,q.CollectionId,
            [new FolderDeleteTarget(q.FolderId,q.ExpectedVersion)],[]),ct);
}
// A single UnitOfWork removes all selected requests and folder descendants atomically.
// Only explicit roots require a version; descendants are still protected by EF concurrency.
public sealed record FolderDeleteTarget(Guid Id,int Version);
public sealed record DeleteFolderItemsCommand(Guid ActorId,Guid WorkspaceId,Guid CollectionId,
    IReadOnlyList<FolderDeleteTarget> Folders,IReadOnlyList<Guid> RequestIds):IRequest;
public sealed class DeleteFolderItemsHandler(
    IWorkspaceRepository workspaces,ICollectionRepository collections,
    ICollectionFolderRepository folders,ISavedRequestRepository requests,IUnitOfWork uow)
    :IRequestHandler<DeleteFolderItemsCommand>
{
    public async ValueTask<Unit> Handle(DeleteFolderItemsCommand cmd,CancellationToken ct)
    {
        await CloudFolderRules.CheckAccess(cmd.ActorId,cmd.WorkspaceId,cmd.CollectionId,true,workspaces,collections,ct);
        if(cmd.Folders is null||cmd.RequestIds is null||cmd.Folders.Count+cmd.RequestIds.Count is 0 or > 200)
            throw AppException.BadRequest("Select 1 to 200 requests or folders");
        if(cmd.Folders.Any(x=>x.Id==Guid.Empty||x.Version<1)||cmd.RequestIds.Any(x=>x==Guid.Empty))
            throw AppException.BadRequest("Invalid deletion selection");
        var allFolders=await folders.ListAsync(cmd.CollectionId,ct);
        var byId=allFolders.ToDictionary(x=>x.Id);
        var selectedFolderIds=cmd.Folders.Select(x=>x.Id).ToHashSet();
        if(cmd.Folders.Any(x=>!byId.TryGetValue(x.Id,out var folder)||folder.Version!=x.Version))
            throw AppException.Conflict("A selected folder changed. Reload before deleting.");
        var deletedFolders=new HashSet<Guid>();
        // Bounded walk; no silent partial deletion if corruption creates a cycle.
        void Walk(Guid id,HashSet<Guid> path)
        {
            if(!path.Add(id))throw AppException.Conflict("Invalid cyclic folder hierarchy");
            deletedFolders.Add(id);
            foreach(var child in allFolders.Where(x=>x.ParentFolderId==id))
                if(!deletedFolders.Contains(child.Id))Walk(child.Id,path);
            path.Remove(id);
        }
        foreach(var id in selectedFolderIds)Walk(id,new HashSet<Guid>());
        var allRequests=await requests.ListAsync(cmd.CollectionId,ct);
        var byRequestId=allRequests.ToDictionary(x=>x.Id);
        if(cmd.RequestIds.Any(id=>!byRequestId.ContainsKey(id)))
            throw AppException.Conflict("A selected request changed. Reload before deleting.");
        var requestsToDelete=allRequests.Where(x=>cmd.RequestIds.Contains(x.Id)
            ||(x.FolderId is Guid folder && deletedFolders.Contains(folder))).ToArray();
        // Both repository methods stage tracked deletes; EF commits them in one SaveChanges transaction.
        foreach(var request in requestsToDelete)requests.Remove(request);
        foreach(var folder in allFolders.Where(x=>deletedFolders.Contains(x.Id)))folders.Remove(folder);
        await uow.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
