using Pakpost.Application.Internal.Workspaces.Commands;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Application.Internal.Workspaces.Queries;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pakpost.Api.Extensions;
using Pakpost.Domain.Enums;
using Pakpost.Api.Realtime;
using Microsoft.AspNetCore.SignalR;

namespace Pakpost.Api.Controllers;
[ApiController]
[Authorize]
[EnableRateLimiting("auth")]
public sealed class WorkspaceInvitationsController(ISender sender, IHubContext<WorkspaceHub> hub,
    ILogger<WorkspaceInvitationsController> logger):ControllerBase
{
    public sealed record InviteRequest(string Email,IReadOnlyList<WorkspaceAccessRole> Roles);
    public sealed record AcceptRequest(string Token);
    [HttpGet("api/workspaces/{workspaceId:guid}/invitations")]
    public async Task<ActionResult<IReadOnlyList<InvitationDto>>> List(Guid workspaceId,CancellationToken ct)
        =>Ok(await sender.Send(new ListWorkspaceInvitationsQuery(User.GetUserId(),workspaceId),ct));
    [HttpPost("api/workspaces/{workspaceId:guid}/invitations")]
    public async Task<ActionResult<InvitationDto>> Invite(Guid workspaceId,InviteRequest request,CancellationToken ct)
        =>Ok(await sender.Send(new InviteWorkspaceMemberCommand(User.GetUserId(),workspaceId,request.Email,request.Roles),ct));
    [HttpPost("api/workspaces/{workspaceId:guid}/invitations/{invitationId:guid}/resend")]
    public async Task<ActionResult<InvitationDto>> Resend(Guid workspaceId,Guid invitationId,CancellationToken ct)
        =>Ok(await sender.Send(new ResendWorkspaceInvitationCommand(User.GetUserId(),workspaceId,invitationId),ct));
    [HttpDelete("api/workspaces/{workspaceId:guid}/invitations/{invitationId:guid}")]
    public async Task<IActionResult> Revoke(Guid workspaceId,Guid invitationId,CancellationToken ct)
    {await sender.Send(new RevokeWorkspaceInvitationCommand(User.GetUserId(),workspaceId,invitationId),ct);return NoContent();}
    [HttpPost("api/invitations/accept")]
    public async Task<ActionResult<WorkspaceDto>> Accept(AcceptRequest request,CancellationToken ct)
    {
        var userId = User.GetUserId();
        var workspace = await sender.Send(new AcceptWorkspaceInvitationCommand(userId,request.Token),ct);
        // The handler has committed membership and invitation acceptance. A
        // transient SignalR failure must not report the committed join as failed.
        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            await hub.Clients.Group(WorkspaceHub.GroupName(workspace.Id)).SendAsync(
                "WorkspaceMemberJoined", new { workspaceId = workspace.Id, userId, eventId = Guid.NewGuid() }, timeout.Token);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Workspace member joined notification failed after commit");
        }
        return Ok(workspace);
    }
}
