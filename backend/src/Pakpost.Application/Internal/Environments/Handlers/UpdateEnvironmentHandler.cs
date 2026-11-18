using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;
using Pakpost.Application.Common.Security;

namespace Pakpost.Application.Internal.Environments;

public sealed class UpdateEnvironmentHandler(
    IWorkspaceRepository workspaces,
    IRequestEnvironmentRepository environments,
    IEnvironmentValueCipher cipher,
    IUnitOfWork uow)
    : IRequestHandler<UpdateEnvironmentCommand, RequestEnvironmentDto>
{
    public async ValueTask<RequestEnvironmentDto> Handle(UpdateEnvironmentCommand c, CancellationToken ct)
    {
        await EnvironmentAccess.Verify(workspaces, c.WorkspaceId, c.ActorId, true, ct);
        var environment = await environments.FindAsync(c.EnvironmentId, ct);
        if (environment is null || environment.WorkspaceId != c.WorkspaceId)
            throw AppException.NotFound();
        environment.Update(c.Name);
        // Keep tracked children for matching keys, explicitly insert new keys and delete removed keys.
        // Replacing the entire navigation with entities with pre-assigned GUID keys can cause EF
        // to issue UPDATEs for rows that have never existed (DbUpdateConcurrencyException).
        var existing = environment.Variables.ToDictionary(v => v.Key, StringComparer.OrdinalIgnoreCase);
        var retained = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var variable in c.Variables)
        {
            var key = variable.Key.Trim();
            var storedValue = variable.IsSecret?cipher.Protect(variable.Value):variable.Value;
            retained.Add(key);
            if (existing.TryGetValue(key, out var tracked))tracked.Update(key, storedValue, variable.IsSecret);
            else
            {
                var added = new RequestEnvironmentVariable(environment.Id, key, storedValue, variable.IsSecret);
                environment.Variables.Add(added);
                environments.AddVariable(added);
            }
        }
        foreach (var removed in environment.Variables.Where(v => !retained.Contains(v.Key)).ToArray())
        {
            environments.RemoveVariable(removed);
            environment.Variables.Remove(removed);
        }
        await uow.SaveChangesAsync(ct);
        return EnvironmentAccess.ToDto(environment, cipher, canReadSecrets:true);
    }
}
