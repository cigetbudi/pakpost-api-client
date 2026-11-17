using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pakpost.Api.Extensions;
using Pakpost.Api.Realtime;
using Pakpost.Application.Internal.Collections;

namespace Pakpost.Api.Controllers;
[ApiController]
[Authorize]
[Route("api/workspaces/{workspaceId:guid}/collections")]
public sealed class CollectionsController(ISender sender,IWorkspaceChangePublisher realtime) : ControllerBase
{
    public sealed record CreateCollectionRequest(string Name);
    private string Instance => Request.Headers["X-PakPost-Instance"].ToString();

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CollectionDto>>> List(Guid workspaceId, CancellationToken ct)
        => Ok(await sender.Send(new ListCollectionsQuery(User.GetUserId(), workspaceId), ct));

    [HttpGet("{collectionId:guid}/variables")]
    public async Task<ActionResult<CollectionVariablesDto>> GetVariables(Guid workspaceId, Guid collectionId, CancellationToken ct)
        => Ok(await sender.Send(new GetCollectionVariablesQuery(User.GetUserId(), workspaceId, collectionId), ct));

    [HttpPut("{collectionId:guid}/variables")]
    public async Task<ActionResult<CollectionVariablesDto>> SaveVariables(Guid workspaceId, Guid collectionId,
        [FromBody] SaveCollectionVariablesRequest body, CancellationToken ct)
    {
        var result=await sender.Send(new SaveCollectionVariablesCommand(User.GetUserId(), workspaceId,
            collectionId, body.Version, body.Variables), ct);
        await realtime.PublishAsync(workspaceId,"collection.variables",collectionId,null,null,Instance,ct);
        return Ok(result);
    }

    public sealed record SaveCollectionVariablesRequest(int Version, List<CollectionVariableDto> Variables);

    [HttpPut("{collectionId:guid}")]
    public async Task<ActionResult<CollectionDto>> Rename(Guid workspaceId, Guid collectionId, [FromBody] CreateCollectionRequest body, CancellationToken ct)
    {
        var result=await sender.Send(new RenameCollectionCommand(User.GetUserId(), workspaceId, collectionId, body.Name), ct);
        await realtime.PublishAsync(workspaceId,"collection.updated",collectionId,null,null,Instance,ct);
        return Ok(result);
    }

    [HttpDelete("{collectionId:guid}")]
    public async Task<IActionResult> Delete(Guid workspaceId, Guid collectionId, CancellationToken ct)
    {
        await sender.Send(new DeleteCollectionCommand(User.GetUserId(), workspaceId, collectionId), ct);
        await realtime.PublishAsync(workspaceId,"collection.deleted",collectionId,null,null,Instance,ct);
        return NoContent();
    }

    [HttpPost]
    public async Task<ActionResult<CollectionDto>> Create(Guid workspaceId, [FromBody] CreateCollectionRequest body, CancellationToken ct)
    {
        var result=await sender.Send(new CreateCollectionCommand(User.GetUserId(), workspaceId, body.Name), ct);
        await realtime.PublishAsync(workspaceId,"collection.created",result.Id,null,null,Instance,ct);
        return Ok(result);
    }
}
