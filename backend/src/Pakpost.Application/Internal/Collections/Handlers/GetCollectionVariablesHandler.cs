using System.Text.Json;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;

namespace Pakpost.Application.Internal.Collections;

public sealed class GetCollectionVariablesHandler(ICollectionRepository collections,
    IWorkspaceRepository workspaces, IEnvironmentValueCipher cipher)
    : IRequestHandler<GetCollectionVariablesQuery, CollectionVariablesDto>
{
    public async ValueTask<CollectionVariablesDto> Handle(GetCollectionVariablesQuery query, CancellationToken ct)
    {
        var member = await WorkspacePermissions.RequireAsync(workspaces, query.WorkspaceId, query.ActorId,
            WorkspacePermissions.CollectionRead, ct);
        var item = await collections.FindAsync(query.CollectionId, ct);
        if (item is null || item.WorkspaceId != query.WorkspaceId)
            throw AppException.NotFound("Collection not found");
        return CollectionVariableMapper.ToDto(item.VariablesVersion, CollectionVariableMapper.Read(item.VariablesJson),
            cipher, WorkspacePermissions.Can(member, WorkspacePermissions.EnvironmentSecretRead));
    }
}
