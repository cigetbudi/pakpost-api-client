using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Mediator;
using Pakpost.Application.Internal.Workspaces.DTOs;

namespace Pakpost.Application.Internal.Workspaces.Queries;

public sealed record ListWorkspaceInvitationsQuery(Guid ActorId, Guid WorkspaceId) : IRequest<IReadOnlyList<InvitationDto>>;
