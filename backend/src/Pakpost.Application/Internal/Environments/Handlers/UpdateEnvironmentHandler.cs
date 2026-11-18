using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Environments.Commands;
using Pakpost.Application.Internal.Environments.DTOs;
using Pakpost.Application.Internal.Environments.Services;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Environments.Handlers;

public sealed class UpdateEnvironmentHandler(
    IWorkspaceRepository workspaces,
    IRequestEnvironmentRepository environments,
    IEnvironmentValueCipher cipher,
    IUnitOfWork unitOfWork)
    : IRequestHandler<UpdateEnvironmentCommand, RequestEnvironmentDto>
{
    public async ValueTask<RequestEnvironmentDto> Handle(
        UpdateEnvironmentCommand command,
        CancellationToken ct)
    {
        await EnvironmentAccess.Verify(
            workspaces,
            command.WorkspaceId,
            command.ActorId,
            true,
            ct);

        var environment = await environments.FindAsync(command.EnvironmentId, ct);

        if (environment is null || environment.WorkspaceId != command.WorkspaceId)
        {
            throw AppException.NotFound();
        }

        environment.Update(command.Name);

        var existing = environment.Variables.ToDictionary(
            variable => variable.Key,
            StringComparer.OrdinalIgnoreCase);

        var retained = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var variable in command.Variables)
        {
            var key = variable.Key.Trim();
            var storedValue = variable.IsSecret
                ? cipher.Protect(variable.Value)
                : variable.Value;

            retained.Add(key);

            if (existing.TryGetValue(key, out var tracked))
            {
                tracked.Update(key, storedValue, variable.IsSecret);
                continue;
            }

            var added = new RequestEnvironmentVariable(
                environment.Id,
                key,
                storedValue,
                variable.IsSecret);

            environment.Variables.Add(added);
            environments.AddVariable(added);
        }

        foreach (var removed in environment.Variables
            .Where(variable => !retained.Contains(variable.Key))
            .ToArray())
        {
            environments.RemoveVariable(removed);
            environment.Variables.Remove(removed);
        }

        await unitOfWork.SaveChangesAsync(ct);

        return EnvironmentAccess.ToDto(environment, cipher, canReadSecrets: true);
    }
}
