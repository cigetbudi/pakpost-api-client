using Pakpost.Application.Internal.Workspaces.Commands;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Application.Internal.Workspaces.Queries;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.RateLimiting;
using Pakpost.Api.Realtime;
using Pakpost.Api.Extensions;
using Pakpost.Domain.Enums;

namespace Pakpost.Api.Controllers;
[ApiController]
[Authorize]
[Route("api/workspaces")]
public sealed class WorkspacesController(ISender sender,WorkspaceConnectionRegistry connections,IHubContext<WorkspaceHub> hub) : ControllerBase
{
    public sealed record CreateWorkspaceRequest(string Name);
    public sealed record AddMemberRequest(string Email, WorkspaceRole Role=WorkspaceRole.Member, IReadOnlyList<WorkspaceAccessRole>? Roles=null);
    public sealed record SetMemberRolesRequest(IReadOnlyList<WorkspaceAccessRole> Roles);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<WorkspaceDto>>> List(CancellationToken ct)
        => Ok(await sender.Send(new ListWorkspacesQuery(User.GetUserId()), ct));

    [HttpGet("capabilities")]
    public async Task<ActionResult<WorkspaceCapabilitiesDto>> Capabilities(CancellationToken ct)
        =>Ok(await sender.Send(new GetWorkspaceCapabilitiesQuery(User.GetUserId()),ct));

    [HttpPost, EnableRateLimiting("auth")]
    public async Task<ActionResult<WorkspaceDto>> Create([FromBody] CreateWorkspaceRequest body, CancellationToken ct)
        => Ok(await sender.Send(new CreateWorkspaceCommand(User.GetUserId(), body.Name), ct));

    [HttpDelete("{workspaceId:guid}")]
    public async Task<IActionResult> Delete(Guid workspaceId, CancellationToken ct)
    {
        await sender.Send(new DeleteWorkspaceCommand(User.GetUserId(), workspaceId), ct);
        await connections.RevokeWorkspaceAsync(hub, workspaceId);
        return NoContent();
    }

    [HttpGet("{workspaceId:guid}/members")]
    public async Task<ActionResult<IReadOnlyList<MemberDto>>> Members(Guid workspaceId, CancellationToken ct)
        => Ok(await sender.Send(new ListWorkspaceMembersQuery(User.GetUserId(), workspaceId), ct));

    [HttpPost("{workspaceId:guid}/members")]
    public async Task<ActionResult<MemberDto>> AddMember(Guid workspaceId, [FromBody] AddMemberRequest body, CancellationToken ct)
        => Ok(await sender.Send(new AddWorkspaceMemberCommand(User.GetUserId(), workspaceId, body.Email, body.Role, body.Roles), ct));

    [HttpPut("{workspaceId:guid}/members/{userId:guid}/roles")]
    public async Task<ActionResult<MemberDto>> SetRoles(Guid workspaceId,Guid userId,
        [FromBody] SetMemberRolesRequest body,CancellationToken ct)
    {
        var result=await sender.Send(new UpdateWorkspaceMemberRolesCommand(User.GetUserId(),workspaceId,userId,body.Roles),ct);
        // Remove old group access immediately; affected sessions must rejoin and reauthorize.
        await connections.ReauthorizeUserAsync(hub,workspaceId,userId);
        return Ok(result);
    }
}
