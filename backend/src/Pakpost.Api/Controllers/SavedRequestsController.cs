using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pakpost.Api.Extensions;
using Pakpost.Application.Internal.Collections;
namespace Pakpost.Api.Controllers;
[ApiController,Authorize]
[Route("api/workspaces/{workspaceId:guid}/collections/{collectionId:guid}/requests")]
public sealed class SavedRequestsController(ISender sender):ControllerBase
{
    public sealed record SaveRequestBody(string Name,string Method,string Url,string HeadersJson,string Body);
    [HttpGet]
    public async Task<IActionResult> List(Guid workspaceId,Guid collectionId,CancellationToken ct)
        =>Ok(await sender.Send(new ListSavedRequestsQuery(User.GetUserId(),workspaceId,collectionId),ct));
    [HttpPost]
    public async Task<IActionResult> Save(Guid workspaceId,Guid collectionId,SaveRequestBody body,CancellationToken ct)
        =>Ok(await sender.Send(new SaveRequestCommand(User.GetUserId(),workspaceId,collectionId,body.Name,body.Method,body.Url,body.HeadersJson,body.Body),ct));
    [HttpDelete("{requestId:guid}")]
    public async Task<IActionResult> Delete(Guid workspaceId,Guid collectionId,Guid requestId,CancellationToken ct)
    { await sender.Send(new DeleteSavedRequestCommand(User.GetUserId(),workspaceId,collectionId,requestId),ct);return NoContent(); }
}
