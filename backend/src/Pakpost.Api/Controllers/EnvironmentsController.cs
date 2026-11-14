using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pakpost.Api.Extensions;
using Pakpost.Application.Internal.Environments;
namespace Pakpost.Api.Controllers;
[ApiController][Authorize][Route("api/workspaces/{workspaceId:guid}/environments")]
public sealed class EnvironmentsController(ISender sender):ControllerBase
{
    public sealed record CreateEnvironmentRequest(string Name);
    public sealed record UpdateEnvironmentRequest(string Name,List<EnvironmentVariableDto> Variables);
    [HttpGet]
    public async Task<IActionResult> List(Guid workspaceId,CancellationToken ct)
        => Ok(await sender.Send(new ListEnvironmentsQuery(User.GetUserId(),workspaceId),ct));
    [HttpPost]
    public async Task<IActionResult> Create(Guid workspaceId,[FromBody] CreateEnvironmentRequest request,CancellationToken ct)
        => Ok(await sender.Send(new CreateEnvironmentCommand(User.GetUserId(),workspaceId,request.Name),ct));
    [HttpPut("{environmentId:guid}")]
    public async Task<IActionResult> Update(Guid workspaceId,Guid environmentId,[FromBody] UpdateEnvironmentRequest request,CancellationToken ct)
        => Ok(await sender.Send(new UpdateEnvironmentCommand(User.GetUserId(),workspaceId,environmentId,request.Name,request.Variables),ct));
    [HttpDelete("{environmentId:guid}")]
    public async Task<IActionResult> Delete(Guid workspaceId,Guid environmentId,CancellationToken ct)
    {await sender.Send(new DeleteEnvironmentCommand(User.GetUserId(),workspaceId,environmentId),ct);return NoContent();}
}
