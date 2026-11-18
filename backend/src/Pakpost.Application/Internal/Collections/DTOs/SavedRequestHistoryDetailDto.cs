using System.Text.Json;

namespace Pakpost.Application.Internal.Collections.DTOs;

public sealed record SavedRequestHistoryDetailDto(int Revision, string Action, Guid ActorId, DateTimeOffset CreatedAt, SavedRequestDto Request);
