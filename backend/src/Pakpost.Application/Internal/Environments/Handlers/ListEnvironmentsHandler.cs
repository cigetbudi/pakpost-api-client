using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;
using Pakpost.Application.Common.Security;

namespace Pakpost.Application.Internal.Environments;

public sealed class ListEnvironmentsHandler(
    IWorkspaceRepository workspaces,
    IRequestEnvironmentRepository environments,
    IEnvironmentValueCipher cipher)
    : IRequestHandler<ListEnvironmentsQuery, IReadOnlyList<RequestEnvironmentDto>>
{
    public async ValueTask<IReadOnlyList<RequestEnvironmentDto>> Handle(ListEnvironmentsQuery q, CancellationToken ct)
    {
        var member = await EnvironmentAccess.Verify(workspaces, q.WorkspaceId, q.ActorId, false, ct);
        bool canReadSecrets = WorkspacePermissions.Can(member, WorkspacePermissions.EnvironmentSecretRead);
        return (await environments.ListAsync(q.WorkspaceId, ct)).Select(e => EnvironmentAccess.ToDto(e, cipher, canReadSecrets)).ToArray();
    }
}
