using System.Text.Json;

namespace Pakpost.Application.Internal.Collections.DTOs;

public sealed record CollectionVariablesDto(int Version, IReadOnlyList<CollectionVariableDto> Variables);
