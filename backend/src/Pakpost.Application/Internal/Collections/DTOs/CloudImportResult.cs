using System.Text.Json;

namespace Pakpost.Application.Internal.Collections.DTOs;

public sealed record CloudImportResult(int Count, int CreatedCount, Guid? FirstId,
    IReadOnlyList<CollectionDto> Collections);
