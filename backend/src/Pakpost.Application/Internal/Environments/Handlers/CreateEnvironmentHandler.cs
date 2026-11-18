using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;
using Pakpost.Application.Common.Security;

namespace Pakpost.Application.Internal.Environments;

public sealed class CreateEnvironmentHandler(IWorkspaceRepository workspaces, IRequestEnvironmentRepository environments, IUnitOfWork uow)
    : IRequestHandler<CreateEnvironmentCommand, RequestEnvironmentDto>
{
    public async ValueTask<RequestEnvironmentDto> Handle(CreateEnvironmentCommand c, CancellationToken ct)
    {
        await EnvironmentAccess.Verify(workspaces, c.WorkspaceId, c.ActorId, true, ct);
        var environment = new RequestEnvironment(c.WorkspaceId, c.Name);
        environments.Add(environment);
        await uow.SaveChangesAsync(ct);
        return new(environment.Id, environment.Name, []);
    }
}
