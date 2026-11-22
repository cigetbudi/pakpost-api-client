using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pakpost.Api.Extensions;
using Pakpost.Application.Internal.Collections.Queries;

namespace Pakpost.Api.Controllers;

/// <summary>Read-side CQRS endpoints; no realtime publishing or writes.</summary>
[ApiController, Authorize]
[Route("api/workspaces/{workspaceId:guid}/collections/{collectionId:guid}/requests")]
public sealed class SavedRequestReadController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(Guid workspaceId,Guid collectionId,CancellationToken ct)
        =>Ok(await sender.Send(new ListSavedRequestsQuery(User.GetUserId(),workspaceId,collectionId),ct));
    [HttpGet("index")]
    public async Task<IActionResult> Index(Guid workspaceId, Guid collectionId, CancellationToken ct)
        => Ok(await sender.Send(new ListSavedRequestIndexQuery(User.GetUserId(), workspaceId, collectionId), ct));

    // Additive browsing API. Existing /index remains for full exports and runners.
    [HttpGet("index/page")]
    public async Task<IActionResult> Page(Guid workspaceId, Guid collectionId,
        [FromQuery] int size = 120, [FromQuery] string? after = null,
        [FromQuery] string? search = null, [FromQuery] Guid? folderId = null,
        [FromQuery] bool rootOnly = false, [FromQuery] bool sortByName = false,
        CancellationToken ct = default)
        => Ok(await sender.Send(new PageSavedRequestIndexQuery(User.GetUserId(),
            workspaceId, collectionId, size, after, search, folderId, rootOnly, sortByName), ct));

    [HttpGet("{requestId:guid}")]
    public async Task<IActionResult> Detail(Guid workspaceId, Guid collectionId, Guid requestId, CancellationToken ct)
        => Ok(await sender.Send(new GetSavedRequestQuery(User.GetUserId(), workspaceId, collectionId, requestId), ct));

    [HttpGet("{requestId:guid}/history")]
    public async Task<IActionResult> History(Guid workspaceId,Guid collectionId,Guid requestId,CancellationToken ct)
        =>Ok(await sender.Send(new ListSavedRequestHistoryQuery(User.GetUserId(),workspaceId,collectionId,requestId),ct));
    [HttpGet("{requestId:guid}/history/{revision:int}")]
    public async Task<IActionResult> HistoryDetail(Guid workspaceId,Guid collectionId,Guid requestId,int revision,CancellationToken ct)
        =>Ok(await sender.Send(new GetSavedRequestHistoryQuery(User.GetUserId(),workspaceId,collectionId,requestId,revision),ct));
}
