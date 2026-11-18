using System.Text.Json;

namespace Pakpost.Application.Internal.Collections.DTOs;

public sealed record CloudImportCollection(string Name, List<CollectionVariableDto> Variables,
    List<CloudImportRequest> Requests);
