using FluentValidation;
using Mediator;

namespace Pakpost.Application.Internal.Requests;

public interface IHttpRequestRunner { Task<SendHttpResponse> ExecuteAsync(SendHttpRequestCommand command, CancellationToken ct);
}
