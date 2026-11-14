using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pakpost.Api.Extensions;
using Pakpost.Application.Internal.Workspaces;
using Pakpost.Domain.Enums;

namespace Pakpost.Api.Controllers;
[ApiController]
[Authorize]
[Route("api/workspaces")]
public sealed class WorkspacesController(ISender sender) : ControllerBase
{
    public sealed record CreateWorkspaceRequest(string Name);
    public sealed record AddMemberRequest(string Email, WorkspaceRole Role);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<WorkspaceDto>>> List(CancellationToken ct)
        => Ok(await sender.Send(new ListWorkspacesQuery(User.GetUserId()), ct));

    [HttpPost]
    public async Task<ActionResult<WorkspaceDto>> Create([FromBody] CreateWorkspaceRequest body, CancellationToken ct)
        => Ok(await sender.Send(new CreateWorkspaceCommand(User.GetUserId(), body.Name), ct));

    [HttpGet("{workspaceId:guid}/members")]
    public async Task<ActionResult<IReadOnlyList<MemberDto>>> Members(Guid workspaceId, CancellationToken ct)
        => Ok(await sender.Send(new ListWorkspaceMembersQuery(User.GetUserId(), workspaceId), ct));

    [HttpPost("{workspaceId:guid}/members")]
    public async Task<ActionResult<MemberDto>> AddMember(Guid workspaceId, [FromBody] AddMemberRequest body, CancellationToken ct)
        => Ok(await sender.Send(new AddWorkspaceMemberCommand(User.GetUserId(), workspaceId, body.Email, body.Role), ct));
}
