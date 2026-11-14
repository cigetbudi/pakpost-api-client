using FluentValidation;
using MediatR;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;
namespace Pakpost.Application.Internal.Teams;
public sealed record TeamDto(Guid Id,Guid WorkspaceId,string Name);
public sealed record TeamMemberDto(Guid UserId,string Email,string DisplayName);
public sealed record ListTeamsQuery(Guid ActorId,Guid WorkspaceId):IRequest<IReadOnlyList<TeamDto>>;
public sealed record CreateTeamCommand(Guid ActorId,Guid WorkspaceId,string Name):IRequest<TeamDto>;
public sealed record ListTeamMembersQuery(Guid ActorId,Guid WorkspaceId,Guid TeamId):IRequest<IReadOnlyList<TeamMemberDto>>;
public sealed record AddTeamMemberCommand(Guid ActorId,Guid WorkspaceId,Guid TeamId,string Email):IRequest<TeamMemberDto>;
public sealed class CreateTeamValidator:AbstractValidator<CreateTeamCommand>
{ public CreateTeamValidator()=>RuleFor(x=>x.Name).NotEmpty().MaximumLength(120); }
public sealed class AddTeamMemberValidator:AbstractValidator<AddTeamMemberCommand>
{ public AddTeamMemberValidator()=>RuleFor(x=>x.Email).NotEmpty().EmailAddress(); }
public sealed class ListTeamsHandler(IWorkspaceRepository w,ITeamRepository t):IRequestHandler<ListTeamsQuery,IReadOnlyList<TeamDto>>
{
    public async Task<IReadOnlyList<TeamDto>> Handle(ListTeamsQuery q,CancellationToken ct)
    { if(await w.FindMemberAsync(q.WorkspaceId,q.ActorId,ct) is null) throw AppException.Forbidden();
      return (await t.ListAsync(q.WorkspaceId,ct)).Select(x=>new TeamDto(x.Id,x.WorkspaceId,x.Name)).ToArray(); }
}
public sealed class CreateTeamHandler(IWorkspaceRepository w,ITeamRepository t,IUnitOfWork uow):IRequestHandler<CreateTeamCommand,TeamDto>
{
    public async Task<TeamDto> Handle(CreateTeamCommand q,CancellationToken ct)
    { var actor=await w.FindMemberAsync(q.WorkspaceId,q.ActorId,ct);
      if(actor is null || actor.Role is not (WorkspaceRole.Owner or WorkspaceRole.Admin))throw AppException.Forbidden();
      var team=new Team(q.WorkspaceId,q.ActorId,q.Name);t.Add(team);
      t.AddMember(new TeamMember(team.Id,q.ActorId));await uow.SaveChangesAsync(ct);
      return new(team.Id,team.WorkspaceId,team.Name); }
}
public sealed class ListTeamMembersHandler(IWorkspaceRepository w,ITeamRepository t,IUserRepository users):IRequestHandler<ListTeamMembersQuery,IReadOnlyList<TeamMemberDto>>
{
    public async Task<IReadOnlyList<TeamMemberDto>> Handle(ListTeamMembersQuery q,CancellationToken ct)
    { if(await w.FindMemberAsync(q.WorkspaceId,q.ActorId,ct) is null)throw AppException.Forbidden();
      var team=await t.FindAsync(q.TeamId,ct);
      if(team is null || team.WorkspaceId!=q.WorkspaceId) throw AppException.NotFound();
      var result=new List<TeamMemberDto>();
      foreach(var m in await t.ListMembersAsync(team.Id,ct))
      {var user=await users.FindByIdAsync(m.UserId,ct);if(user is not null)result.Add(new(user.Id,user.Email,user.DisplayName));}
      return result; }
}
public sealed class AddTeamMemberHandler(IWorkspaceRepository w,ITeamRepository t,IUserRepository users,IUnitOfWork uow):IRequestHandler<AddTeamMemberCommand,TeamMemberDto>
{
    public async Task<TeamMemberDto> Handle(AddTeamMemberCommand q,CancellationToken ct)
    { var actor=await w.FindMemberAsync(q.WorkspaceId,q.ActorId,ct);
      if(actor is null || actor.Role is not (WorkspaceRole.Owner or WorkspaceRole.Admin))throw AppException.Forbidden();
      var team=await t.FindAsync(q.TeamId,ct);
      if(team is null || team.WorkspaceId!=q.WorkspaceId)throw AppException.NotFound();
      var user=await users.FindByEmailAsync(q.Email.Trim().ToLowerInvariant(),ct)
        ?? throw AppException.NotFound("User must register first");
      if(await w.FindMemberAsync(q.WorkspaceId,user.Id,ct) is null)throw AppException.BadRequest("User must join workspace first");
      if(await t.HasMemberAsync(team.Id,user.Id,ct))throw AppException.Conflict("Already a team member");
      t.AddMember(new TeamMember(team.Id,user.Id));await uow.SaveChangesAsync(ct);
      return new(user.Id,user.Email,user.DisplayName); }
}
