using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pakpost.Api.Extensions;
using Pakpost.Application.Internal.Teams;
namespace Pakpost.Api.Controllers;
[ApiController,Authorize,Route("api/workspaces/{workspaceId:guid}/teams")]
public sealed class TeamsController(ISender sender):ControllerBase
{
    public sealed record CreateTeamBody(string Name);
    public sealed record AddTeamMemberBody(string Email);
    [HttpGet]
    public async Task<IActionResult> List(Guid workspaceId,CancellationToken ct)=>
        Ok(await sender.Send(new ListTeamsQuery(User.GetUserId(),workspaceId),ct));
    [HttpPost]
    public async Task<IActionResult> Create(Guid workspaceId,CreateTeamBody body,CancellationToken ct)=>
        Ok(await sender.Send(new CreateTeamCommand(User.GetUserId(),workspaceId,body.Name),ct));
    [HttpGet("{teamId:guid}/members")]
    public async Task<IActionResult> Members(Guid workspaceId,Guid teamId,CancellationToken ct)=>
        Ok(await sender.Send(new ListTeamMembersQuery(User.GetUserId(),workspaceId,teamId),ct));
    [HttpPost("{teamId:guid}/members")]
    public async Task<IActionResult> AddMember(Guid workspaceId,Guid teamId,AddTeamMemberBody body,CancellationToken ct)=>
        Ok(await sender.Send(new AddTeamMemberCommand(User.GetUserId(),workspaceId,teamId,body.Email),ct));
}
