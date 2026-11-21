
namespace Pakpost.Application.Internal.Workspaces.DTOs;

public sealed record WorkspaceCapabilitiesDto(bool CanCreateWorkspace,
    string DeploymentMode, int? MaxMembersPerWorkspace);
