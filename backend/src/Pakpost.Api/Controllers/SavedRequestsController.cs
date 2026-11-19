using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.Queries;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pakpost.Api.Extensions;
using Pakpost.Api.Realtime;
namespace Pakpost.Api.Controllers;
[ApiController,Authorize]
[Route("api/workspaces/{workspaceId:guid}/collections/{collectionId:guid}/requests")]
public sealed class SavedRequestsController(ISender sender,IWorkspaceChangePublisher realtime):ControllerBase
{
    public sealed record SaveRequestBody(string Name,string Method,string Url,string HeadersJson,string Body,
        string BodyMode="raw",string ContentType="application/json",string FormFieldsJson="[]",string PreRequestScript="",string PostResponseScript="",int? Revision=null,Guid? FolderId=null);
    private string Instance => Request.Headers["X-PakPost-Instance"].ToString();
    [HttpGet]
    public async Task<IActionResult> List(Guid workspaceId,Guid collectionId,CancellationToken ct)
        =>Ok(await sender.Send(new ListSavedRequestsQuery(User.GetUserId(),workspaceId,collectionId),ct));
    [HttpGet("index")]
    public async Task<IActionResult> Index(Guid workspaceId, Guid collectionId, CancellationToken ct)
        => Ok(await sender.Send(new ListSavedRequestIndexQuery(User.GetUserId(), workspaceId, collectionId), ct));

    [HttpGet("{requestId:guid}")]
    public async Task<IActionResult> Detail(Guid workspaceId, Guid collectionId, Guid requestId, CancellationToken ct)
        => Ok(await sender.Send(new GetSavedRequestQuery(User.GetUserId(), workspaceId, collectionId, requestId), ct));

    [HttpPost]
    public async Task<IActionResult> Save(Guid workspaceId,Guid collectionId,SaveRequestBody body,CancellationToken ct)
    {
        var result=await sender.Send(new SaveRequestCommand(User.GetUserId(),workspaceId,collectionId,body.Name,body.Method,body.Url,body.HeadersJson,body.Body,body.BodyMode,body.ContentType,body.FormFieldsJson,body.PreRequestScript,body.PostResponseScript,body.FolderId),ct);
        await realtime.PublishAsync(workspaceId,"request.created",collectionId,result.Id,result.Revision,Instance,ct);
        return Ok(result);
    }
    [HttpPut("{requestId:guid}")]
    public async Task<IActionResult> Update(Guid workspaceId,Guid collectionId,Guid requestId,SaveRequestBody body,CancellationToken ct)
    {
        var result=await sender.Send(new UpdateSavedRequestCommand(User.GetUserId(),workspaceId,collectionId,requestId,
            body.Name,body.Method,body.Url,body.HeadersJson,body.Body,body.BodyMode,body.ContentType,body.FormFieldsJson,body.PreRequestScript,body.PostResponseScript,body.Revision),ct);
        await realtime.PublishAsync(workspaceId,"request.updated",collectionId,result.Id,result.Revision,Instance,ct);
        return Ok(result);
    }
    [HttpGet("{requestId:guid}/history")]
    public async Task<IActionResult> History(Guid workspaceId,Guid collectionId,Guid requestId,CancellationToken ct)
        =>Ok(await sender.Send(new ListSavedRequestHistoryQuery(User.GetUserId(),workspaceId,collectionId,requestId),ct));
    [HttpGet("{requestId:guid}/history/{revision:int}")]
    public async Task<IActionResult> HistoryDetail(Guid workspaceId,Guid collectionId,Guid requestId,int revision,CancellationToken ct)
        =>Ok(await sender.Send(new GetSavedRequestHistoryQuery(User.GetUserId(),workspaceId,collectionId,requestId,revision),ct));
    public sealed record RestoreRevisionBody(int ExpectedRevision);
    [HttpPost("{requestId:guid}/history/{revision:int}/restore")]
    public async Task<IActionResult> Restore(Guid workspaceId,Guid collectionId,Guid requestId,int revision,[FromBody] RestoreRevisionBody body,CancellationToken ct)
    {
        var result=await sender.Send(new RestoreSavedRequestHistoryCommand(User.GetUserId(),workspaceId,collectionId,requestId,revision,body.ExpectedRevision),ct);
        await realtime.PublishAsync(workspaceId,"request.updated",collectionId,result.Id,result.Revision,Instance,ct);
        return Ok(result);
    }
    public sealed record MoveRequestBody(Guid TargetCollectionId,Guid? TargetFolderId=null);
    [HttpPatch("{requestId:guid}/move")]
    public async Task<IActionResult> Move(Guid workspaceId,Guid collectionId,Guid requestId,[FromBody] MoveRequestBody body,CancellationToken ct)
    {
        var result=await sender.Send(new MoveSavedRequestCommand(User.GetUserId(),workspaceId,collectionId,requestId,body.TargetCollectionId,body.TargetFolderId),ct);
        await realtime.PublishAsync(workspaceId,"request.moved",collectionId,requestId,result.Revision,Instance,ct);
        await realtime.PublishAsync(workspaceId,"request.created",body.TargetCollectionId,requestId,result.Revision,Instance,ct);
        return Ok(result);
    }
    [HttpDelete("{requestId:guid}")]
    public async Task<IActionResult> Delete(Guid workspaceId,Guid collectionId,Guid requestId,CancellationToken ct)
    {
        await sender.Send(new DeleteSavedRequestCommand(User.GetUserId(),workspaceId,collectionId,requestId),ct);
        await realtime.PublishAsync(workspaceId,"request.deleted",collectionId,requestId,null,Instance,ct);
        return NoContent();
    }
}
