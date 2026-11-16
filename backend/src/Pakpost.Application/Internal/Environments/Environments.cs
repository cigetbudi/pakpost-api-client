using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;
using Pakpost.Application.Common.Security;
namespace Pakpost.Application.Internal.Environments;
public sealed record EnvironmentVariableDto(string Key,string Value,bool IsSecret,bool IsRedacted=false);
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
    public static async Task<WorkspaceMember> Verify(IWorkspaceRepository workspaces,Guid ws,Guid actor,bool write,CancellationToken ct)
        =>await WorkspacePermissions.RequireAsync(workspaces,ws,actor,
            write?WorkspacePermissions.EnvironmentWrite:WorkspacePermissions.EnvironmentRead,ct);
    // A read-only member cannot decrypt a shared secret. A masked value is not an empty secret.
    public static RequestEnvironmentDto ToDto(RequestEnvironment env,IEnvironmentValueCipher cipher,bool canReadSecrets)
        =>new(env.Id,env.Name,env.Variables.Select(v=>new EnvironmentVariableDto(
            v.Key,v.IsSecret?(canReadSecrets?cipher.Unprotect(v.StoredValue):string.Empty):v.StoredValue,
            v.IsSecret,v.IsSecret&&!canReadSecrets)).ToArray());
}
public sealed class ListEnvironmentsHandler(IWorkspaceRepository workspaces,IRequestEnvironmentRepository environments,IEnvironmentValueCipher cipher)
    :IRequestHandler<ListEnvironmentsQuery,IReadOnlyList<RequestEnvironmentDto>>
{
    public async ValueTask<IReadOnlyList<RequestEnvironmentDto>> Handle(ListEnvironmentsQuery q,CancellationToken ct)
    {
        var member=await EnvironmentAccess.Verify(workspaces,q.WorkspaceId,q.ActorId,false,ct);
        bool canReadSecrets=WorkspacePermissions.Can(member,WorkspacePermissions.EnvironmentSecretRead);
        return (await environments.ListAsync(q.WorkspaceId,ct)).Select(e=>EnvironmentAccess.ToDto(e,cipher,canReadSecrets)).ToArray();
    }
}
public sealed class CreateEnvironmentHandler(IWorkspaceRepository workspaces,IRequestEnvironmentRepository environments,IUnitOfWork uow)
    :IRequestHandler<CreateEnvironmentCommand,RequestEnvironmentDto>
{
    public async ValueTask<RequestEnvironmentDto> Handle(CreateEnvironmentCommand c,CancellationToken ct)
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
    public async ValueTask<RequestEnvironmentDto> Handle(UpdateEnvironmentCommand c,CancellationToken ct)
    {
        await EnvironmentAccess.Verify(workspaces,c.WorkspaceId,c.ActorId,true,ct);
        var environment=await environments.FindAsync(c.EnvironmentId,ct);
        if(environment is null||environment.WorkspaceId!=c.WorkspaceId)throw AppException.NotFound();
        environment.Update(c.Name);
        // Keep tracked children for matching keys, explicitly insert new keys and delete removed keys.
        // Replacing the entire navigation with entities with pre-assigned GUID keys can cause EF
        // to issue UPDATEs for rows that have never existed (DbUpdateConcurrencyException).
        var existing = environment.Variables.ToDictionary(v=>v.Key,StringComparer.OrdinalIgnoreCase);
        var retained = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach(var variable in c.Variables)
        {
            var key=variable.Key.Trim();
            var storedValue=variable.IsSecret?cipher.Protect(variable.Value):variable.Value;
            retained.Add(key);
            if(existing.TryGetValue(key,out var tracked))tracked.Update(key,storedValue,variable.IsSecret);
            else
            {
                var added=new RequestEnvironmentVariable(environment.Id,key,storedValue,variable.IsSecret);
                environment.Variables.Add(added);
                environments.AddVariable(added);
            }
        }
        foreach(var removed in environment.Variables.Where(v=>!retained.Contains(v.Key)).ToArray())
        {
            environments.RemoveVariable(removed);
            environment.Variables.Remove(removed);
        }
        await uow.SaveChangesAsync(ct);
        return EnvironmentAccess.ToDto(environment,cipher,canReadSecrets:true);
    }
}
public sealed class DeleteEnvironmentHandler(IWorkspaceRepository workspaces,IRequestEnvironmentRepository environments,IUnitOfWork uow)
    :IRequestHandler<DeleteEnvironmentCommand>
{
    public async ValueTask<Unit> Handle(DeleteEnvironmentCommand c,CancellationToken ct)
    {
        await EnvironmentAccess.Verify(workspaces,c.WorkspaceId,c.ActorId,true,ct);
        var env=await environments.FindAsync(c.EnvironmentId,ct);
        if(env is null||env.WorkspaceId!=c.WorkspaceId)throw AppException.NotFound();
        environments.Remove(env);await uow.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
