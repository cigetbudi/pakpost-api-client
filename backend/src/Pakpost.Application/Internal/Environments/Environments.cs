using FluentValidation;
using MediatR;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;
namespace Pakpost.Application.Internal.Environments;
public sealed record EnvironmentVariableDto(string Key,string Value,bool IsSecret);
public sealed record RequestEnvironmentDto(Guid Id,string Name,IReadOnlyList<EnvironmentVariableDto> Variables);
public sealed record ListEnvironmentsQuery(Guid ActorId,Guid WorkspaceId):IRequest<IReadOnlyList<RequestEnvironmentDto>>;
public sealed record CreateEnvironmentCommand(Guid ActorId,Guid WorkspaceId,string Name):IRequest<RequestEnvironmentDto>;
public sealed record UpdateEnvironmentCommand(Guid ActorId,Guid WorkspaceId,Guid EnvironmentId,string Name,List<EnvironmentVariableDto> Variables):IRequest<RequestEnvironmentDto>;
public sealed record DeleteEnvironmentCommand(Guid ActorId,Guid WorkspaceId,Guid EnvironmentId):IRequest;
public sealed class CreateEnvironmentValidator:AbstractValidator<CreateEnvironmentCommand>
{ public CreateEnvironmentValidator(){RuleFor(x=>x.Name).NotEmpty().MaximumLength(120);} }
public sealed class UpdateEnvironmentValidator:AbstractValidator<UpdateEnvironmentCommand>
{
    public UpdateEnvironmentValidator()
    {
        RuleFor(x=>x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x=>x.Variables).NotNull().Must(x=>x is not null && x.Count<=100);
        RuleForEach(x=>x.Variables).ChildRules(v=>
        {
            v.RuleFor(x=>x.Key).NotEmpty().MaximumLength(120).Matches("^[A-Za-z_][A-Za-z0-9_]*$");
            v.RuleFor(x=>x.Value).MaximumLength(8192);
        });
        RuleFor(x=>x.Variables).Must(x=>x.Select(y=>y.Key).Distinct(StringComparer.OrdinalIgnoreCase).Count()==x.Count)
            .When(x=>x.Variables is not null).WithMessage("Duplicate variable keys");
    }
}
public static class EnvironmentAccess
{
    public static async Task Verify(IWorkspaceRepository workspaces,Guid ws,Guid actor,bool write,CancellationToken ct)
    {
        var member=await workspaces.FindMemberAsync(ws,actor,ct);
        if(member is null || (write && member.Role is not WorkspaceRole.Owner and not WorkspaceRole.Admin))
            throw AppException.Forbidden();
    }
    public static RequestEnvironmentDto ToDto(RequestEnvironment env,IEnvironmentValueCipher cipher)
        => new(env.Id,env.Name,env.Variables.Select(v=>new EnvironmentVariableDto(v.Key,v.IsSecret?cipher.Unprotect(v.StoredValue):v.StoredValue,v.IsSecret)).ToArray());
}
public sealed class ListEnvironmentsHandler(IWorkspaceRepository workspaces,IRequestEnvironmentRepository environments,IEnvironmentValueCipher cipher)
    :IRequestHandler<ListEnvironmentsQuery,IReadOnlyList<RequestEnvironmentDto>>
{
    public async Task<IReadOnlyList<RequestEnvironmentDto>> Handle(ListEnvironmentsQuery q,CancellationToken ct)
    {
        await EnvironmentAccess.Verify(workspaces,q.WorkspaceId,q.ActorId,false,ct);
        return (await environments.ListAsync(q.WorkspaceId,ct)).Select(e=>EnvironmentAccess.ToDto(e,cipher)).ToArray();
    }
}
public sealed class CreateEnvironmentHandler(IWorkspaceRepository workspaces,IRequestEnvironmentRepository environments,IUnitOfWork uow)
    :IRequestHandler<CreateEnvironmentCommand,RequestEnvironmentDto>
{
    public async Task<RequestEnvironmentDto> Handle(CreateEnvironmentCommand c,CancellationToken ct)
    {
        await EnvironmentAccess.Verify(workspaces,c.WorkspaceId,c.ActorId,true,ct);
        var environment=new RequestEnvironment(c.WorkspaceId,c.Name);
        environments.Add(environment);await uow.SaveChangesAsync(ct);
        return new(environment.Id,environment.Name,[]);
    }
}
public sealed class UpdateEnvironmentHandler(IWorkspaceRepository workspaces,IRequestEnvironmentRepository environments,IEnvironmentValueCipher cipher,IUnitOfWork uow)
    :IRequestHandler<UpdateEnvironmentCommand,RequestEnvironmentDto>
{
    public async Task<RequestEnvironmentDto> Handle(UpdateEnvironmentCommand c,CancellationToken ct)
    {
        await EnvironmentAccess.Verify(workspaces,c.WorkspaceId,c.ActorId,true,ct);
        var environment=await environments.FindAsync(c.EnvironmentId,ct);
        if(environment is null||environment.WorkspaceId!=c.WorkspaceId)throw AppException.NotFound();
        environment.Update(c.Name);
        environment.ReplaceVariables(c.Variables.Select(v=>new RequestEnvironmentVariable(environment.Id,v.Key,v.IsSecret?cipher.Protect(v.Value):v.Value,v.IsSecret)));
        await uow.SaveChangesAsync(ct);
        return EnvironmentAccess.ToDto(environment,cipher);
    }
}
public sealed class DeleteEnvironmentHandler(IWorkspaceRepository workspaces,IRequestEnvironmentRepository environments,IUnitOfWork uow)
    :IRequestHandler<DeleteEnvironmentCommand>
{
    public async Task Handle(DeleteEnvironmentCommand c,CancellationToken ct)
    {
        await EnvironmentAccess.Verify(workspaces,c.WorkspaceId,c.ActorId,true,ct);
        var env=await environments.FindAsync(c.EnvironmentId,ct);
        if(env is null||env.WorkspaceId!=c.WorkspaceId)throw AppException.NotFound();
        environments.Remove(env);await uow.SaveChangesAsync(ct);
    }
}
