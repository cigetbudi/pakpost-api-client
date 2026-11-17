using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pakpost.Api.Extensions;
using Pakpost.Api.Realtime;
using Pakpost.Application.Internal.Collections;

namespace Pakpost.Api.Controllers;
[ApiController,Authorize]
[Route("api/workspaces/{workspaceId:guid}/collections/{collectionId:guid}/folders")]
public sealed class CollectionFoldersController(ISender sender,IWorkspaceChangePublisher realtime):ControllerBase
{
    private string Instance=>Request.Headers["X-PakPost-Instance"].ToString();
    public sealed record CreateBody(string Name,Guid? ParentFolderId);
    public sealed record RenameBody(string Name,int Version);
    public sealed record MoveBody(Guid? ParentFolderId,int Version);
    public sealed record DeleteItemsBody(List<FolderDeleteTarget> Folders,List<Guid> RequestIds);
    [HttpPost("delete-items")]
    public async Task<IActionResult> DeleteItems(Guid workspaceId,Guid collectionId,[FromBody] DeleteItemsBody body,CancellationToken ct)
    {
        await sender.Send(new DeleteFolderItemsCommand(User.GetUserId(),workspaceId,collectionId,
            body.Folders,body.RequestIds),ct);
        await realtime.PublishAsync(workspaceId,"folder.deleted",collectionId,null,null,Instance,ct);
        await realtime.PublishAsync(workspaceId,"request.deleted",collectionId,null,null,Instance,ct);
        return NoContent();
    }
    [HttpGet]
    public async Task<IActionResult> List(Guid workspaceId,Guid collectionId,CancellationToken ct)
        =>Ok(await sender.Send(new ListFoldersQuery(User.GetUserId(),workspaceId,collectionId),ct));
    [HttpPost]
    public async Task<IActionResult> Create(Guid workspaceId,Guid collectionId,[FromBody] CreateBody body,CancellationToken ct)
    {
        var saved=await sender.Send(new CreateFolderCommand(User.GetUserId(),workspaceId,collectionId,body.ParentFolderId,body.Name),ct);
        await realtime.PublishAsync(workspaceId,"folder.created",collectionId,null,null,Instance,ct);
        return Ok(saved);
    }
    [HttpPut("{folderId:guid}")]
    public async Task<IActionResult> Rename(Guid workspaceId,Guid collectionId,Guid folderId,[FromBody] RenameBody body,CancellationToken ct)
    {
        var saved=await sender.Send(new RenameFolderCommand(User.GetUserId(),workspaceId,collectionId,folderId,body.Name,body.Version),ct);
        await realtime.PublishAsync(workspaceId,"folder.updated",collectionId,null,null,Instance,ct);
        return Ok(saved);
    }
    [HttpPatch("{folderId:guid}/move")]
    public async Task<IActionResult> Move(Guid workspaceId,Guid collectionId,Guid folderId,[FromBody] MoveBody body,CancellationToken ct)
    {
        var saved=await sender.Send(new MoveFolderCommand(User.GetUserId(),workspaceId,collectionId,folderId,body.ParentFolderId,body.Version),ct);
        await realtime.PublishAsync(workspaceId,"folder.moved",collectionId,null,null,Instance,ct);
        return Ok(saved);
    }
    [HttpDelete("{folderId:guid}")]
    public async Task<IActionResult> Delete(Guid workspaceId,Guid collectionId,Guid folderId,[FromQuery] int version,CancellationToken ct)
    {
        await sender.Send(new DeleteFolderCommand(User.GetUserId(),workspaceId,collectionId,folderId,version),ct);
        await realtime.PublishAsync(workspaceId,"folder.deleted",collectionId,null,null,Instance,ct);
        await realtime.PublishAsync(workspaceId,"request.deleted",collectionId,null,null,Instance,ct);
        return NoContent();
    }
}
