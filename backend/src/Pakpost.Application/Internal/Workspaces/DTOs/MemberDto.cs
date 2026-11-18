using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces;

public sealed record MemberDto(Guid UserId, string Email, string DisplayName, WorkspaceRole Role,
    IReadOnlyList<WorkspaceAccessRole> Roles, IReadOnlyList<string> Permissions);
