
namespace Pakpost.Application.Internal.Collections.DTOs;

public sealed record FolderDto(Guid Id, Guid CollectionId, Guid? ParentFolderId, string Name, int Version);
