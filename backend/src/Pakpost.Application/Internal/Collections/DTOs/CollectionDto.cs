
namespace Pakpost.Application.Internal.Collections.DTOs;

public sealed record CollectionDto(Guid Id, Guid WorkspaceId, string Name, int RequestCount = 0);
