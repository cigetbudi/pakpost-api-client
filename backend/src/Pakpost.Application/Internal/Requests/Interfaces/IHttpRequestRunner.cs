using Pakpost.Application.Internal.Requests.Commands;
using Pakpost.Application.Internal.Requests.DTOs;

namespace Pakpost.Application.Internal.Requests.Interfaces;

public interface IHttpRequestRunner { Task<SendHttpResponse> ExecuteAsync(SendHttpRequestCommand command, CancellationToken ct);
}
